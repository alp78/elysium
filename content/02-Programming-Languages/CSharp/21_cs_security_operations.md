---
type: reference
category: programming-languages
technology: [csharp, dotnet, gcp]
tags: [csharp, gcp, security, encryption, identity]
aliases: [Security Operations CSharp, Encryption and Identity CSharp]
keywords: [encryption, KMS, Secret Manager, certificates, service account, OAuth, ADC, IAM, Cloud SQL, SSL, envelope encryption, Polars.NET, Google.Cloud.SecretManager, Google.Cloud.Kms]
description: "C# security operations reference — encryption, certificates, identity, and secure access across GCP services. Executable examples with cell outputs. Built on infrastructure from [20_py_security_setup](https://alp78.github.io/elysium/02-Programming-Languages/Python/20_py_security_setup). See [21_py_security_operations](https://alp78.github.io/elysium/02-Programming-Languages/Python/21_py_security_operations) for the Python equivalent."
created: 2026-03-27
updated: 2026-03-27
status: complete
---

# 21. Security Operations — Encryption, Certificates & Identity (C#)

> [!quote]
> "The only truly secure system is one that is powered off, cast in a block of concrete, and sealed in a lead-lined room with armed guards — and even then I have my doubts."
>
> — **Gene Spafford**, attributed remark (c. 1989)

> [!tip] Prerequisite Reading
>
> For the theoretical framework behind these operations — identity model, credential types, OAuth2 flows, and connection patterns — see [gcp-identity-and-connection-patterns](https://alp78.github.io/elysium/06-GCP/Security/gcp-identity-and-connection-patterns).

## Environment Setup

#### Install NuGet packages

```csharp
// Suppress CS1701/CS1702 assembly version mismatch warnings
// that occur when NuGet packages reference slightly different versions.
using System.Reflection;
using Microsoft.DotNet.Interactive;
using Microsoft.DotNet.Interactive.CSharp;

var csharpKernel = (CSharpKernel)Microsoft.DotNet.Interactive.Kernel.Root.FindKernelByName("csharp");
var optionsField = typeof(CSharpKernel).GetField("_scriptOptions",
    BindingFlags.NonPublic | BindingFlags.Instance);

var scriptOptions = optionsField.GetValue(csharpKernel);
var withWarningLevel = scriptOptions.GetType().GetMethod("WithWarningLevel");
var newOptions = withWarningLevel.Invoke(scriptOptions, new object[] { 0 });
optionsField.SetValue(csharpKernel, newOptions);

Console.WriteLine("  WarningLevel set to 0");
```

      WarningLevel set to 0

```csharp
#r "nuget: Google.Cloud.SecretManager.V1"
#r "nuget: Google.Cloud.Kms.V1"
#r "nuget: Google.Cloud.Storage.V1"
#r "nuget: Google.Cloud.BigQuery.V2"
#r "nuget: Google.Cloud.Firestore"
#r "nuget: Google.Cloud.ResourceManager.V3"
#r "nuget: Google.Cloud.Iam.Credentials.V1"
#r "nuget: Google.Apis.Auth"
#r "nuget: Google.Apis.Iam.v1"
#r "nuget: DotNetEnv"
#r "nuget: Renci.SshNet"
#r "nuget: Microsoft.Data.SqlClient"
```

#### Import namespaces

```csharp
// Standard library
using System;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Security;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json;
using System.Diagnostics;

// Google Cloud
using Google.Apis.Auth.OAuth2;
using Google.Cloud.SecretManager.V1;
using Google.Cloud.Kms.V1;
using Google.Cloud.Storage.V1;
using Google.Cloud.BigQuery.V2;
using Google.Cloud.Firestore;
using Google.Cloud.ResourceManager.V3;
using Google.Cloud.Iam.Credentials.V1;
using Google.Protobuf;

// Third-party
using DotNetEnv;

Console.WriteLine("  Namespaces loaded");
```

      Namespaces loaded

#### Load environment variables from .env

```csharp
// Load .env file so all GCP config is available
DotNetEnv.Env.Load();
Console.WriteLine($"  .env loaded: {File.Exists(".env")}");
```

      .env loaded: True

#### Define project constants

```csharp
// Central config — every cell below references these constants
var PROJECT_ID       = "seclab-dev-ap-26";
var PROJECT_NUMBER   = "922174528852";
var REGION           = "europe-west1";
var ZONE             = "europe-west1-b";
var SA_EMAIL         = "notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com";
var SA_KEY_PATH      = Environment.GetEnvironmentVariable("GCP_SA_KEY_PATH") ?? "./gcp-sa-key.json";
var KMS_LOCATION     = "europe-west1";
var KMS_KEYRING      = "notebook-keyring";
var KMS_KEY          = "notebook-encrypt-key";
var BUCKET_NAME      = $"{PROJECT_ID}-data";
var SQL_INSTANCE     = Environment.GetEnvironmentVariable("GCP_SQL_INSTANCE") ?? "notebook-sql";
var SQL_IP           = Environment.GetEnvironmentVariable("GCP_SQL_IP") ?? "";
var SQL_PASSWORD     = Environment.GetEnvironmentVariable("GCP_SQL_PASSWORD") ?? "";
var BQ_DATASET       = "index_data";
var FIRESTORE_DB     = "seclab-scores";
var VM_NAME          = "notebook-vm";
var SSH_KEY_PATH     = Environment.GetEnvironmentVariable("SSH_KEY_PATH") ?? "";

// Set credentials for Google Cloud SDKs
Environment.SetEnvironmentVariable("GOOGLE_APPLICATION_CREDENTIALS", SA_KEY_PATH);
Console.WriteLine($"  Project:     {PROJECT_ID}");
Console.WriteLine($"  SA:          {SA_EMAIL}");
Console.WriteLine($"  Credentials: {SA_KEY_PATH} (exists: {File.Exists(SA_KEY_PATH)})");
```

      Project:     seclab-dev-ap-26
      SA:          notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      Credentials: ./gcp-sa-key.json (exists: True)

#### GoogleCredential.GetApplicationDefault — verify GCP authentication

```csharp
// Load SA credentials from the JSON key file
var saCredential = ServiceAccountCredential
    .FromServiceAccountData(File.OpenRead(SA_KEY_PATH))
    .ToGoogleCredential()
    .CreateScoped("https://www.googleapis.com/auth/cloud-platform");

Console.WriteLine($"  Credential type: {saCredential.UnderlyingCredential.GetType().Name}");
Console.WriteLine($"  SA key loaded from: {SA_KEY_PATH}");
```

      Credential type: ServiceAccountCredential
      SA key loaded from: ./gcp-sa-key.json

## Identity and Authentication

#### GoogleCredential.FromFile — service account key file authentication

```csharp
// Authenticate using the SA JSON key and call the Resource Manager API
// This proves the SA key works and has project-level access
var rmClient = ProjectsClient.Create();
var project = rmClient.GetProject(new GetProjectRequest { Name = $"projects/{PROJECT_ID}" });
Console.WriteLine($"  Project:  {project.ProjectId}");
Console.WriteLine($"  Name:     {project.DisplayName}");
Console.WriteLine($"  State:    {project.State}");
```

      Project:  seclab-dev-ap-26
      Name:     Security Lab
      State:    Active

#### GoogleCredential.CreateScoped — restrict API access by scope

```csharp
// Scoped credentials limit which APIs the token can access.
// Even if the SA has broad roles, scoped credentials restrict the token
// to only the specified APIs.
var storageOnly = ServiceAccountCredential
    .FromServiceAccountData(File.OpenRead(SA_KEY_PATH))
    .ToGoogleCredential()
    .CreateScoped("https://www.googleapis.com/auth/devstorage.read_only");

Console.WriteLine($"  Scoped credential type: {storageOnly.UnderlyingCredential.GetType().Name}");
Console.WriteLine($"  Scope: devstorage.read_only (storage only, no KMS/BQ/etc.)");
```

      Scoped credential type: ServiceAccountCredential
      Scope: devstorage.read_only (storage only, no KMS/BQ/etc.)

#### Application Default Credentials (ADC) lookup chain

ADC checks: (1) `GOOGLE_APPLICATION_CREDENTIALS` env var, (2) gcloud default credentials, (3) GCE/GKE metadata server.

```csharp
var adcCredential = GoogleCredential.GetApplicationDefault();
Console.WriteLine($"  ADC type: {adcCredential.UnderlyingCredential.GetType().Name}");
Console.WriteLine($"  Source:   GOOGLE_APPLICATION_CREDENTIALS={SA_KEY_PATH}");
```

      ADC type: ServiceAccountCredential
      Source:   GOOGLE_APPLICATION_CREDENTIALS=./gcp-sa-key.json

#### Service account impersonation — keyless authentication

Impersonation: act as another SA without its key. Requires `roles/iam.serviceAccountTokenCreator`. Use for dev testing, CI/CD escalation, cross-project access. Don't grant at project level — scope to specific SAs.

```csharp
var sourceCredential = GoogleCredential.GetApplicationDefault();
var impersonated = sourceCredential.Impersonate(new ImpersonatedCredential.Initializer(SA_EMAIL)
{
    Scopes = new[] { "https://www.googleapis.com/auth/cloud-platform" }
});

// Force token fetch to prove impersonation works
var token = await impersonated.UnderlyingCredential.GetAccessTokenForRequestAsync();
Console.WriteLine($"  Impersonating: {SA_EMAIL}");
Console.WriteLine($"  Token (first 30): {token[..30]}...");
```

      Impersonating: notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      Token (first 30): ya29.c.c0AZ4bNpYDOg1GXze7sTabO...

#### IAMCredentialsClient — generate short-lived OAuth2 access tokens

```csharp
// Generate a short-lived access token (300s-3600s) for time-boxed operations.
// When to use: handing off to untrusted code, time-boxing sensitive operations.
// When NOT to use: long-running jobs (token expires mid-run).
var iamCredClient = IAMCredentialsClient.Create();
var tokenResponse = iamCredClient.GenerateAccessToken(
    new GenerateAccessTokenRequest
    {
        Name = $"projects/-/serviceAccounts/{SA_EMAIL}",
        Scope = { "https://www.googleapis.com/auth/cloud-platform" },
        Lifetime = Google.Protobuf.WellKnownTypes.Duration.FromTimeSpan(TimeSpan.FromSeconds(600))
    });

Console.WriteLine($"  Token (first 30): {tokenResponse.AccessToken[..30]}...");
Console.WriteLine($"  Expires at:       {tokenResponse.ExpireTime}");
Console.WriteLine($"  Lifetime:         600 seconds");
```

      Token (first 30): ya29.c.c0AZ4bNpYbd94MEMMOIq5CF...
      Expires at:       "2026-03-26T04:36:47Z"
      Lifetime:         600 seconds

## Secret Manager — Secure Secret Lifecycle

#### SecretManagerServiceClient.AccessSecretVersion — read secrets

```csharp
// Read secrets stored during project setup.
// Secrets are versioned — "latest" gets the most recent active version.
var smClient = SecretManagerServiceClient.Create();

var secretNames = new[] { "test-api-key", "db-password", "db-config" };
foreach (var name in secretNames)
{
    var secretPath = $"projects/{PROJECT_ID}/secrets/{name}/versions/latest";
    try
    {
        var response = smClient.AccessSecretVersion(secretPath);
        var value = response.Payload.Data.ToStringUtf8();
        var masked = value.Length > 8 ? value[..4] + "***" + value[^4..] : "***";
        var version = response.Name.Split('/')[^1];
        Console.WriteLine($"  {name,-20} version={version,-8} value={masked}");
    }
    catch (Exception e)
    {
        Console.WriteLine($"  {name,-20} ERROR: {e.Message}");
    }
}
```

      test-api-key         version=1        value=sk_t***2345
      db-password          version=1        value=EsgD***ass1
      db-config            version=1        value={"ho***xx"}

#### SecretManagerServiceClient.CreateSecret — labels and replication

Use Secret Manager for API keys, passwords, certificates. Never hardcode secrets or bake them into Docker images.

```csharp
var newSecretId = "notebook-demo-secret-cs";
try
{
    var secret = smClient.CreateSecret(new CreateSecretRequest
    {
        Parent = $"projects/{PROJECT_ID}",
        SecretId = newSecretId,
        Secret = new Secret
        {
            Replication = new Replication { Automatic = new Replication.Types.Automatic() },
            Labels = { ["environment"] = "lab", ["created-by"] = "notebook-21-cs" }
        }
    });
    Console.WriteLine($"  Created: {secret.SecretName}");
}
catch (Grpc.Core.RpcException e) when (e.StatusCode == Grpc.Core.StatusCode.AlreadyExists)
{
    Console.WriteLine($"  Secret {newSecretId} already exists — skipping creation");
}
```

      Created: projects/922174528852/secrets/notebook-demo-secret-cs

#### SecretManagerServiceClient.AddSecretVersion — secret rotation

Add a new version — old versions stay until disabled. Rotate: API/SA keys 90 days, DB passwords 30–90 days, certificates before expiry.

```csharp
var newPassword = Convert.ToBase64String(RandomNumberGenerator.GetBytes(24));
var version = smClient.AddSecretVersion(new AddSecretVersionRequest
{
    ParentAsSecretName = SecretName.FromProjectSecret(PROJECT_ID, newSecretId),
    Payload = new SecretPayload { Data = ByteString.CopyFromUtf8(newPassword) }
});

Console.WriteLine($"  New version: {version.SecretVersionName.SecretVersionId}");
Console.WriteLine($"  State:       {version.State}");
Console.WriteLine($"  Value (first 8): {newPassword[..8]}...");
```

      New version: 1
      State:       Enabled
      Value (first 8): 5jzVIRIA...

#### SecretManagerServiceClient — disable and destroy old versions

```csharp
// After rotation, disable the old version so it cannot be accessed,
// then schedule destruction after a grace period.
var parent = SecretName.FromProjectSecret(PROJECT_ID, newSecretId);
var versions = smClient.ListSecretVersions(parent);

Console.WriteLine($"  Versions for {newSecretId}:");
foreach (var v in versions)
{
    Console.WriteLine($"    v{v.SecretVersionName.SecretVersionId}: {v.State}");
}

// Disable version 1 if it exists and is enabled
var allVersions = versions.ToList();
if (allVersions.Count > 1)
{
    var oldest = allVersions[^1];
    if (oldest.State == SecretVersion.Types.State.Enabled)
    {
        smClient.DisableSecretVersion(oldest.Name);
        Console.WriteLine($"  Disabled: v{oldest.SecretVersionName.SecretVersionId}");
    }
}
```

      Versions for notebook-demo-secret-cs:
        v1: Enabled

#### Parse JSON secret — database config

```csharp
// Secrets can store any string — JSON configs, connection strings, certificates.
var dbConfigPath = $"projects/{PROJECT_ID}/secrets/db-config/versions/latest";
try
{
    var response = smClient.AccessSecretVersion(dbConfigPath);
    var jsonStr = response.Payload.Data.ToStringUtf8();
    var config = JsonSerializer.Deserialize<JsonElement>(jsonStr);

    Console.WriteLine($"  Host:     {config.GetProperty("host").GetString()}");
    Console.WriteLine($"  Port:     {config.GetProperty("port").GetInt32()}");
    Console.WriteLine($"  Database: {config.GetProperty("database").GetString()}");
}
catch (Exception e)
{
    Console.WriteLine($"  db-config: {e.Message}");
}
```

      Host:     34.22.129.89
      Port:     1433
      Database: stoxx

## Cloud KMS — Encryption and Key Management

#### What Cloud KMS does and when to use it

**Key ring** — regional grouping (cannot be deleted). **CryptoKey** — named key with rotation schedule. **Key version** — actual material, auto-rotated. **Envelope encryption** — KMS wraps a short DEK, app encrypts data with it. Don't encrypt >64 KB directly; don't destroy versions before re-encrypting.

```csharp
var kmsClient = KeyManagementServiceClient.Create();
var keyName = new CryptoKeyName(PROJECT_ID, KMS_LOCATION, KMS_KEYRING, KMS_KEY);
Console.WriteLine($"  KMS client ready");
Console.WriteLine($"  Key: {keyName}");
```

      KMS client ready
      Key: projects/seclab-dev-ap-26/locations/europe-west1/keyRings/notebook-keyring/cryptoKeys/notebook-encrypt-key

#### KeyManagementServiceClient.Encrypt — symmetric encryption

KMS encrypt: for small values (<64 KB) with audit trail. Each call is logged. Key rotation automatic. For >64 KB or high-throughput, use envelope encryption.

```csharp
var plaintext = Encoding.UTF8.GetBytes("Sensitive financial data: EUROSTOXX50 daily returns");

var encryptResponse = kmsClient.Encrypt(keyName, ByteString.CopyFrom(plaintext));
var ciphertext = encryptResponse.Ciphertext;

Console.WriteLine($"  Plaintext:        {Encoding.UTF8.GetString(plaintext)}");
Console.WriteLine($"  Ciphertext (b64): {Convert.ToBase64String(ciphertext.ToByteArray())[..60]}...");
Console.WriteLine($"  Ciphertext size:  {ciphertext.Length} bytes");
```

      Plaintext:        Sensitive financial data: EUROSTOXX50 daily returns
      Ciphertext (b64): CiQAvMIMG5In14bQf0oRroUVEdJZH5as1mM2OWQFVcRKEUz2Ib4SXAA/1XLb...
      Ciphertext size:  132 bytes

#### KeyManagementServiceClient.Decrypt — symmetric decryption

```csharp
// Decrypt the ciphertext back to plaintext using the same KMS key.
// KMS determines the correct key version from metadata in the ciphertext.
var decryptResponse = kmsClient.Decrypt(keyName, ciphertext);
var decrypted = decryptResponse.Plaintext.ToByteArray();

Console.WriteLine($"  Decrypted: {Encoding.UTF8.GetString(decrypted)}");
Console.WriteLine($"  Match:     {plaintext.SequenceEqual(decrypted)}");
```

      Decrypted: Sensitive financial data: EUROSTOXX50 daily returns
      Match:     True

#### AesGcm + KeyManagementServiceClient — envelope encryption

Envelope encryption: generate local DEK, encrypt data with AES-GCM (built into .NET), wrap DEK with KMS. For >64 KB, high-throughput, or cost optimization (one KMS call per DEK).

```csharp
var dek = RandomNumberGenerator.GetBytes(32);  // 256-bit DEK
var nonce = RandomNumberGenerator.GetBytes(12); // 96-bit nonce
Console.WriteLine($"  DEK (b64):  {Convert.ToBase64String(dek)[..30]}...");

// Encrypt data locally with the DEK
var largeData = new byte[10_000];
Array.Fill(largeData, (byte)0x41);  // Fill with 'A'
var encryptedData = new byte[largeData.Length];
var tag = new byte[16];
using (var aesGcm = new AesGcm(dek, 16))
{
    aesGcm.Encrypt(nonce, largeData, encryptedData, tag);
}
Console.WriteLine($"  Data encrypted: {encryptedData.Length} bytes (from {largeData.Length} bytes)");

// Wrap the DEK with KMS
var wrapResponse = kmsClient.Encrypt(keyName, ByteString.CopyFrom(dek));
var wrappedDek = wrapResponse.Ciphertext;
Console.WriteLine($"  Wrapped DEK:    {wrappedDek.Length} bytes");

// Store: encryptedData + nonce + tag + wrappedDek
Console.WriteLine();
Console.WriteLine($"  Envelope encryption result:");
Console.WriteLine($"    Encrypted data: {encryptedData.Length} bytes");
Console.WriteLine($"    Nonce:          {nonce.Length} bytes");
Console.WriteLine($"    Tag:            {tag.Length} bytes");
Console.WriteLine($"    Wrapped DEK:    {wrappedDek.Length} bytes");
```

      DEK (b64):  O+2rK6Si6aHI0gAc2ABU06Qeuqx+R5...
      Data encrypted: 10000 bytes (from 10000 bytes)
      Wrapped DEK:    113 bytes
    
      Envelope encryption result:
        Encrypted data: 10000 bytes
        Nonce:          12 bytes
        Tag:            16 bytes
        Wrapped DEK:    113 bytes

#### AesGcm + KeyManagementServiceClient — envelope decryption

```csharp
// Reverse the envelope: unwrap DEK with KMS, then decrypt data locally.
var unwrapResponse = kmsClient.Decrypt(keyName, wrappedDek);
var unwrappedDek = unwrapResponse.Plaintext.ToByteArray();

var decryptedData = new byte[encryptedData.Length];
using (var aesGcm = new AesGcm(unwrappedDek, 16))
{
    aesGcm.Decrypt(nonce, encryptedData, tag, decryptedData);
}

Console.WriteLine($"  DEK unwrapped:    {unwrappedDek.Length} bytes");
Console.WriteLine($"  DEK match:        {dek.SequenceEqual(unwrappedDek)}");
Console.WriteLine($"  Data decrypted:   {decryptedData.Length} bytes");
Console.WriteLine($"  Data match:       {largeData.SequenceEqual(decryptedData)}");
```

      DEK unwrapped:    32 bytes
      DEK match:        True
      Data decrypted:   10000 bytes
      Data match:       True

#### KeyManagementServiceClient.GetCryptoKey — list key versions and rotation

```csharp
// Show current key versions — KMS automatically manages version history.
// When you rotate, the new version becomes primary for new encryptions.
// Old ciphertext still decrypts because the version ID is embedded in it.
var key = kmsClient.GetCryptoKey(keyName);
Console.WriteLine($"  Key:             {KMS_KEY}");
Console.WriteLine($"  Purpose:         {key.Purpose}");
Console.WriteLine($"  Primary version: {key.Primary.Name.Split('/')[^1]}");
Console.WriteLine($"  Algorithm:       {key.Primary.Algorithm}");
Console.WriteLine($"  Protection:      {key.Primary.ProtectionLevel}");

var versions = kmsClient.ListCryptoKeyVersions(keyName);
Console.WriteLine("  All versions:");
foreach (var v in versions)
{
    var verNum = v.Name.Split('/')[^1];
    Console.WriteLine($"    v{verNum}: {v.State} (algorithm: {v.Algorithm})");
}
```

      Key:             notebook-encrypt-key
      Purpose:         EncryptDecrypt
      Primary version: 1
      Algorithm:       GoogleSymmetricEncryption
      Protection:      Software
      All versions:
        v1: Enabled (algorithm: GoogleSymmetricEncryption)

## Cloud SQL — SQL Server Authentication and Encryption

| Method | Best for |
|---|---|
| SQL authentication (username + password) | Dev notebooks, DBA maintenance, legacy apps |
| SSL/TLS server certificate verification | Public internet connections, compliance (PCI-DSS, SOC2) |
| Cloud SQL Auth Proxy | Production services on GKE/Cloud Run, CI/CD pipelines |
| IP allowlisting (authorized networks) | Dev access from known office/VPN IP |

For Cloud SQL SQL Server, username + password is the only practical client auth method. The cert verifies the server; the password verifies you. C# advantage: `Microsoft.Data.SqlClient` is native — not a FreeTDS wrapper.

#### SQL Server password authentication — direct connect

```csharp
// Connect to Cloud SQL for SQL Server using Microsoft.Data.SqlClient.
// Native driver with full TLS support, unlike pymssql/FreeTDS in Python.
using Microsoft.Data.SqlClient;

var connStr = new SqlConnectionStringBuilder
{
    DataSource = $"{SQL_IP},1433",
    UserID = "sqlserver",
    Password = SQL_PASSWORD,
    InitialCatalog = "stoxx",
    Encrypt = true,
    TrustServerCertificate = true,  // Cloud SQL uses self-signed certs
    ConnectTimeout = 10
}.ConnectionString;

try
{
    using var conn = new SqlConnection(connStr);
    conn.Open();

    using var cmd = new SqlCommand("SELECT @@VERSION", conn);
    var version = cmd.ExecuteScalar()?.ToString() ?? "unknown";
    Console.WriteLine($"  Connected to Cloud SQL");
    Console.WriteLine($"  Version: {version[..80]}...");

    using var cmd2 = new SqlCommand("SELECT GETDATE()", conn);
    var now = cmd2.ExecuteScalar();
    Console.WriteLine($"  Server time: {now}");
}
catch (Exception e)
{
    Console.WriteLine($"  Connection failed: {e.Message}");
    Console.WriteLine($"  Ensure your IP is authorized: gcloud sql instances patch {SQL_INSTANCE} --authorized-networks=YOUR_IP/32");
}
```

      Connected to Cloud SQL
      Version: Microsoft SQL Server 2022 (RTM-CU23) (KB5078297) - 16.0.4236.2 (X64) 
    	Jan 22 20...
      Server time: 26-Mar-26 4:34:16

#### SQL Server — CRUD operations

```csharp
// Perform CRUD operations to verify full SQL Server access.
// Using parameterized queries to prevent SQL injection.
try
{
    using var conn = new SqlConnection(connStr);
    conn.Open();

    // Create
    using (var cmd = new SqlCommand(@"
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'security_test')
        CREATE TABLE security_test (
            id INT IDENTITY(1,1) PRIMARY KEY,
            symbol NVARCHAR(20),
            score FLOAT,
            created_at DATETIME DEFAULT GETDATE()
        )", conn))
    { cmd.ExecuteNonQuery(); }

    // Insert
    using (var cmd = new SqlCommand("INSERT INTO security_test (symbol, score) VALUES (@s, @v)", conn))
    {
        cmd.Parameters.AddWithValue("@s", "AAPL");
        cmd.Parameters.AddWithValue("@v", 95.5);
        cmd.ExecuteNonQuery();
    }
    using (var cmd = new SqlCommand("INSERT INTO security_test (symbol, score) VALUES (@s, @v)", conn))
    {
        cmd.Parameters.AddWithValue("@s", "MSFT");
        cmd.Parameters.AddWithValue("@v", 88.2);
        cmd.ExecuteNonQuery();
    }
    Console.WriteLine("  Inserted 2 rows into security_test");

    // Query
    using (var cmd = new SqlCommand("SELECT id, symbol, score, created_at FROM security_test", conn))
    using (var reader = cmd.ExecuteReader())
    {
        while (reader.Read())
            Console.WriteLine($"    {reader.GetInt32(0),3}  {reader.GetString(1),-10}  {reader.GetDouble(2),6:F1}  {reader.GetDateTime(3)}");
    }

    // Drop
    using (var cmd = new SqlCommand("DROP TABLE security_test", conn))
    { cmd.ExecuteNonQuery(); }
    Console.WriteLine("  Dropped security_test table");
}
catch (Exception e)
{
    Console.WriteLine($"  SQL operations failed: {e.Message}");
}
```

      Inserted 2 rows into security_test
          1  AAPL          95.5  26-Mar-26 4:34:20
          2  MSFT          88.2  26-Mar-26 4:34:20
      Dropped security_test table

#### SqlConnection + SSL — verified connection to Cloud SQL

`Encrypt=true` + `TrustServerCertificate=false` forces cert chain validation. C# advantage: `SqlClient` has native TLS — no FreeTDS workarounds. Never use `TrustServerCertificate=true` in production.

```csharp
var sslConnStr = new SqlConnectionStringBuilder
{
    DataSource = $"{SQL_IP},1433",
    UserID = "sqlserver",
    Password = SQL_PASSWORD,
    InitialCatalog = "stoxx",
    Encrypt = true,
    TrustServerCertificate = false  // Require valid cert chain
}.ConnectionString;

try
{
    using var conn = new SqlConnection(sslConnStr);
    conn.Open();
    Console.WriteLine("  SSL-verified connection: OK");
}
catch (SqlException e)
{
    Console.WriteLine($"  SSL-verified connection: {e.Message[..100]}");
    Console.WriteLine("  Expected: Cloud SQL uses a self-signed CA not in the local trust store.");
    Console.WriteLine("  Fix: download server-ca.pem and add to trust store, or use Auth Proxy.");
}
```

      SSL-verified connection: A connection was successfully established with the server, but then an error occurred during the log
      Expected: Cloud SQL uses a self-signed CA not in the local trust store.
      Fix: download server-ca.pem and add to trust store, or use Auth Proxy.

#### Cloud SQL encryption at rest — check CMEK

```csharp
// Check if the Cloud SQL instance uses CMEK or Google-managed encryption.
// Empty output = Google-managed (default). CMEK shows the KMS key path.
var p = new System.Diagnostics.Process();
p.StartInfo.FileName = "cmd.exe";
p.StartInfo.Arguments = $"/c gcloud sql instances describe {SQL_INSTANCE} --format=yaml(diskEncryptionConfiguration,diskEncryptionStatus)";
p.StartInfo.RedirectStandardOutput = true;
p.StartInfo.UseShellExecute = false;
p.Start();
var output = p.StandardOutput.ReadToEnd();
p.WaitForExit();

if (string.IsNullOrWhiteSpace(output))
    Console.WriteLine("  Encryption: Google-managed (no CMEK)");
else
    Console.WriteLine($"  Encryption:\n{output}");
```

      Encryption:
    diskEncryptionConfiguration:
      kind: sql#diskEncryptionConfiguration
      kmsKeyName: projects/seclab-dev-ap-26/locations/europe-west1/keyRings/notebook-keyring/cryptoKeys/notebook-encrypt-key
    diskEncryptionStatus:
      kind: sql#diskEncryptionStatus
      kmsKeyVersionName: projects/seclab-dev-ap-26/locations/europe-west1/keyRings/notebook-keyring/cryptoKeys/notebook-encrypt-key/cryptoKeyVersions/1

#### System.Data.SqlClient SqlBulkCopy — high-performance bulk insert

C# advantage: `SqlBulkCopy` streams data directly via TDS bulk insert — no temp files, no `bcp` CLI. Python needs: GCS → pyarrow → temp TSV → bcp → SQL Server. C#: `DataTable` → `SqlBulkCopy` → SQL Server (single step).

```csharp
try
{
    using var conn = new SqlConnection(connStr);
    conn.Open();

    // Create a demo table
    using (var cmd = new SqlCommand(@"
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'bulk_demo')
        CREATE TABLE bulk_demo (id INT, symbol NVARCHAR(20), value FLOAT)", conn))
    { cmd.ExecuteNonQuery(); }

    // Build a DataTable with sample data
    var dt = new System.Data.DataTable();
    dt.Columns.Add("id", typeof(int));
    dt.Columns.Add("symbol", typeof(string));
    dt.Columns.Add("value", typeof(double));
    for (int i = 0; i < 1000; i++)
        dt.Rows.Add(i, $"SYM{i % 50:D3}", Math.Round(100.0 + i * 0.01, 2));

    // Bulk copy — single network operation
    var sw = Stopwatch.StartNew();
    using (var bulk = new SqlBulkCopy(conn))
    {
        bulk.DestinationTableName = "bulk_demo";
        bulk.BatchSize = 500;
        bulk.WriteToServer(dt);
    }
    sw.Stop();
    Console.WriteLine($"  SqlBulkCopy: {dt.Rows.Count} rows in {sw.ElapsedMilliseconds}ms");

    // Verify
    using (var cmd = new SqlCommand("SELECT COUNT(*) FROM bulk_demo", conn))
        Console.WriteLine($"  Rows in table: {cmd.ExecuteScalar()}");

    // Cleanup
    using (var cmd = new SqlCommand("DROP TABLE bulk_demo", conn))
    { cmd.ExecuteNonQuery(); }
    Console.WriteLine("  Dropped bulk_demo table");
}
catch (Exception e)
{
    Console.WriteLine($"  Bulk copy failed: {e.Message}");
}
```

      SqlBulkCopy: 1000 rows in 386ms
      Rows in table: 1000
      Dropped bulk_demo table

## BigQuery — Secure Data Operations

#### BigQueryClient — query with service account credentials

```csharp
// Authenticate to BigQuery using the SA key and run a query.
// BigQuery access is controlled by IAM roles (bigquery.dataViewer or higher).
var bqClient = BigQueryClient.Create(PROJECT_ID);

var sql = $@"SELECT symbol, ROUND(close, 2) AS close,
       ROUND(momentum_score * 100, 2) AS momentum_pct,
       composite_rank
FROM `{PROJECT_ID}.{BQ_DATASET}.gold_scores`
ORDER BY composite_rank
LIMIT 10";

var results = bqClient.ExecuteQuery(sql, parameters: null);
Console.WriteLine("  Top 10 stocks by composite rank:");
foreach (var row in results)
{
    Console.WriteLine($"    {row["composite_rank"],2}. {row["symbol"],-10} close={row["close"],8} momentum={row["momentum_pct"],7}%");
}
```

      Top 10 stocks by composite rank:
         1. ENI.MI     close=   21.34 momentum=  12.74%
         2. DB1.DE     close=   237.9 momentum=   6.98%
         3. TTE.PA     close=   69.77 momentum=   6.47%
         4. AD.AS      close=   41.05 momentum=   5.54%
         5. PRX.AS     close=   45.69 momentum=   3.28%
         6. DTE.DE     close=   32.55 momentum=   1.81%
         7. WKL.AS     close=   67.32 momentum=   1.17%
         8. AI.PA      close=  168.02 momentum=  -0.96%
         9. SU.PA      close=  254.65 momentum=  -1.03%
        10. ASML.AS    close=  1190.8 momentum=  -1.13%

#### KeyManagementServiceClient + BigQuery — column-level encryption

Encrypt individual field values with KMS before inserting into BigQuery — table stores ciphertext, only KMS decrypt access can recover values. For PII (GDPR, CCPA) and multi-tenant isolation.

```csharp
var sampleData = new[] {
    new { symbol = "AAPL", portfolio_id = "PF-001", allocation = 15.5 },
    new { symbol = "MSFT", portfolio_id = "PF-002", allocation = 22.0 },
    new { symbol = "GOOG", portfolio_id = "PF-003", allocation = 18.3 },
};

var encryptedRows = new List<BigQueryInsertRow>();
foreach (var item in sampleData)
{
    var encResponse = kmsClient.Encrypt(keyName, ByteString.CopyFromUtf8(item.portfolio_id));
    encryptedRows.Add(new BigQueryInsertRow {
        { "symbol", item.symbol },
        { "portfolio_id_encrypted", Convert.ToBase64String(encResponse.Ciphertext.ToByteArray()) },
        { "allocation_pct", item.allocation }
    });
}

// Create table and insert
var tableId = $"{BQ_DATASET}.encrypted_demo_cs";
var schema = new TableSchemaBuilder {
    { "symbol", BigQueryDbType.String },
    { "portfolio_id_encrypted", BigQueryDbType.String },
    { "allocation_pct", BigQueryDbType.Float64 }
}.Build();

try { bqClient.DeleteTable(PROJECT_ID, BQ_DATASET, "encrypted_demo_cs"); } catch { }
bqClient.CreateTable(PROJECT_ID, BQ_DATASET, "encrypted_demo_cs", schema);
bqClient.InsertRows(PROJECT_ID, BQ_DATASET, "encrypted_demo_cs", encryptedRows);
Console.WriteLine($"  Inserted {encryptedRows.Count} rows with encrypted portfolio_id");
```

      Inserted 3 rows with encrypted portfolio_id

#### KeyManagementServiceClient.Decrypt — decrypt BigQuery column values

```csharp
// Query the encrypted table, then decrypt each portfolio_id with KMS.
var encSql = $"SELECT * FROM `{PROJECT_ID}.{BQ_DATASET}.encrypted_demo_cs`";
var encResults = bqClient.ExecuteQuery(encSql, parameters: null);

Console.WriteLine("  Decrypted results:");
foreach (var row in encResults)
{
    var encBytes = Convert.FromBase64String((string)row["portfolio_id_encrypted"]);
    var decResponse = kmsClient.Decrypt(keyName, ByteString.CopyFrom(encBytes));
    var portfolioId = decResponse.Plaintext.ToStringUtf8();
    Console.WriteLine($"    {row["symbol"],-10} portfolio={portfolioId}  allocation={row["allocation_pct"]}%");
}
```

      Decrypted results:
        AAPL       portfolio=PF-001  allocation=15.5%
        MSFT       portfolio=PF-002  allocation=22%
        GOOG       portfolio=PF-003  allocation=18.3%

## Firestore — Secure Document Operations

#### FirestoreDb — read and write documents with SA credentials

```csharp
// Firestore access is controlled by IAM roles (datastore.user or higher).
// Using the REST API directly because the Firestore SDK has an assembly
// binding issue in Polyglot Notebooks (Microsoft.Bcl.AsyncInterfaces mismatch).
var httpClient = new HttpClient();
var accessToken = await saCredential.UnderlyingCredential.GetAccessTokenForRequestAsync();
httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

var fsBaseUrl = $"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/{FIRESTORE_DB}/documents";

// Read existing scores
var resp = await httpClient.GetAsync($"{fsBaseUrl}/scores_latest?pageSize=5");
var json = await resp.Content.ReadAsStringAsync();
var docs = JsonSerializer.Deserialize<JsonElement>(json);

Console.WriteLine("  Read documents from scores_latest:");
if (docs.TryGetProperty("documents", out var docArray))
{
    foreach (var doc in docArray.EnumerateArray().Take(5))
    {
        var name = doc.GetProperty("name").GetString().Split('/')[^1];
        Console.WriteLine($"    {name}");
    }
}
```

      Read documents from scores_latest:
        ABI.BR
        AD.AS
        ADS.DE
        ADYEN.AS
        AI.PA

#### Write and read back a document

```csharp
// Write a test document via REST API and read it back.
var writeBody = JsonSerializer.Serialize(new {
    fields = new {
        message = new { stringValue = "written by C# notebook" },
        timestamp = new { stringValue = DateTime.UtcNow.ToString("o") },
        source = new { stringValue = "21_Security_Operations_cs" }
    }
});

var writeResp = await httpClient.PatchAsync(
    $"{fsBaseUrl}/access_test_cs/demo",
    new StringContent(writeBody, Encoding.UTF8, "application/json")
);
Console.WriteLine($"  Write: {writeResp.StatusCode}");

// Read back
var readResp = await httpClient.GetAsync($"{fsBaseUrl}/access_test_cs/demo");
var readJson = await readResp.Content.ReadAsStringAsync();
Console.WriteLine($"  Read back: {readResp.StatusCode}");
Console.WriteLine($"  Data: {readJson[..Math.Min(200, readJson.Length)]}...");

// Cleanup
await httpClient.DeleteAsync($"{fsBaseUrl}/access_test_cs/demo");
Console.WriteLine("  Cleaned up test document");
```

      Write: OK
      Read back: OK
      Data: {
      "name": "projects/seclab-dev-ap-26/databases/seclab-scores/documents/access_test_cs/demo",
      "fields": {
        "timestamp": {
          "stringValue": "2026-03-26T04:39:43.6907215Z"
        },
        "message"...
      Cleaned up test document

#### KeyManagementServiceClient + Firestore — field-level encryption

```csharp
// Encrypt sensitive fields with KMS before writing to Firestore via REST.
var posEnc = kmsClient.Encrypt(keyName, ByteString.CopyFromUtf8("1500"));
var encB64 = Convert.ToBase64String(posEnc.Ciphertext.ToByteArray());

var encBody = JsonSerializer.Serialize(new {
    fields = new {
        symbol = new { stringValue = "AAPL" },
        position_size_encrypted = new { stringValue = encB64 }
    }
});

var encResp = await httpClient.PatchAsync(
    $"{fsBaseUrl}/encrypted_positions_cs/demo",
    new StringContent(encBody, Encoding.UTF8, "application/json")
);
Console.WriteLine($"  Written encrypted document: {encResp.StatusCode}");

// Read and decrypt
var encReadResp = await httpClient.GetAsync($"{fsBaseUrl}/encrypted_positions_cs/demo");
var encReadJson = JsonSerializer.Deserialize<JsonElement>(await encReadResp.Content.ReadAsStringAsync());
var encValue = encReadJson.GetProperty("fields").GetProperty("position_size_encrypted").GetProperty("stringValue").GetString();
var decResp = kmsClient.Decrypt(keyName, ByteString.CopyFrom(Convert.FromBase64String(encValue)));
Console.WriteLine($"  Decrypted position_size: {decResp.Plaintext.ToStringUtf8()}");

// Cleanup
await httpClient.DeleteAsync($"{fsBaseUrl}/encrypted_positions_cs/demo");
Console.WriteLine("  Cleaned up encrypted document");
```

      Written encrypted document: OK
      Decrypted position_size: 1500
      Cleaned up encrypted document

## Cloud Storage — Encryption and Access Control

#### StorageClient — upload to CMEK-encrypted GCS bucket

```csharp
// Upload a file to the CMEK-encrypted bucket and verify encryption metadata.
var storageClient = StorageClient.Create();
var testContent = Encoding.UTF8.GetBytes("Security test from C# notebook");

using (var ms = new MemoryStream(testContent))
{
    storageClient.UploadObject(BUCKET_NAME, "security-demo/cs_test.txt", "text/plain", ms);
}
Console.WriteLine("  Uploaded: security-demo/cs_test.txt");

// Check encryption metadata
var obj = storageClient.GetObject(BUCKET_NAME, "security-demo/cs_test.txt");
Console.WriteLine($"  KMS key:  {obj.KmsKeyName ?? "Google-managed"}");
Console.WriteLine($"  Size:     {obj.Size} bytes");
```

      Uploaded: security-demo/cs_test.txt
      KMS key:  projects/seclab-dev-ap-26/locations/europe-west1/keyRings/notebook-keyring/cryptoKeys/notebook-encrypt-key/cryptoKeyVersions/1
      Size:     30 bytes

#### AesGcm — client-side encryption before GCS upload

```csharp
// Encrypt data locally with AES-GCM before uploading to GCS.
// .NET advantage: AesGcm is built into System.Security.Cryptography.
var cseDek = RandomNumberGenerator.GetBytes(32);
var cseNonce = RandomNumberGenerator.GetBytes(12);
var cseData = Encoding.UTF8.GetBytes("Client-side encrypted data from C#");
var cseEncrypted = new byte[cseData.Length];
var cseTag = new byte[16];

using (var aes = new AesGcm(cseDek, 16))
    aes.Encrypt(cseNonce, cseData, cseEncrypted, cseTag);

// Combine nonce + tag + ciphertext for storage
var combined = new byte[cseNonce.Length + cseTag.Length + cseEncrypted.Length];
Buffer.BlockCopy(cseNonce, 0, combined, 0, cseNonce.Length);
Buffer.BlockCopy(cseTag, 0, combined, cseNonce.Length, cseTag.Length);
Buffer.BlockCopy(cseEncrypted, 0, combined, cseNonce.Length + cseTag.Length, cseEncrypted.Length);

using (var ms = new MemoryStream(combined))
    storageClient.UploadObject(BUCKET_NAME, "security-demo/cs_encrypted.bin", "application/octet-stream", ms);

Console.WriteLine($"  Uploaded client-side encrypted: {combined.Length} bytes");
Console.WriteLine($"  Original: {cseData.Length} bytes, Encrypted: {cseEncrypted.Length} + {cseTag.Length} tag + {cseNonce.Length} nonce");
```

      Uploaded client-side encrypted: 62 bytes
      Original: 34 bytes, Encrypted: 34 + 16 tag + 12 nonce

#### AesGcm — download and decrypt client-side encrypted file

```csharp
// Download the encrypted blob and decrypt locally.
var dlStream = new MemoryStream();
storageClient.DownloadObject(BUCKET_NAME, "security-demo/cs_encrypted.bin", dlStream);
var dlBytes = dlStream.ToArray();

// Split: nonce (12) + tag (16) + ciphertext
var dlNonce = dlBytes[..12];
var dlTag = dlBytes[12..28];
var dlCipher = dlBytes[28..];
var dlPlain = new byte[dlCipher.Length];

using (var aes = new AesGcm(cseDek, 16))
    aes.Decrypt(dlNonce, dlCipher, dlTag, dlPlain);

Console.WriteLine($"  Downloaded: {dlBytes.Length} bytes");
Console.WriteLine($"  Decrypted:  {Encoding.UTF8.GetString(dlPlain)}");
```

      Downloaded: 62 bytes
      Decrypted:  Client-side encrypted data from C#

#### UrlSigner.FromCredential — generate signed URLs for time-limited access

```csharp
// Signed URLs: grant time-limited access to a private GCS object
// without requiring the caller to authenticate.
//
// When to use: sharing with external users, frontend direct download.
// Anti-patterns: logging signed URLs, long expiration times.
var urlSigner = UrlSigner.FromCredential(
    ServiceAccountCredential.FromServiceAccountData(File.OpenRead(SA_KEY_PATH))
);

var signedUrl = urlSigner.Sign(
    BUCKET_NAME,
    "bronze/csv/dim_index.csv",
    TimeSpan.FromMinutes(15),
    HttpMethod.Get
);

Console.WriteLine($"  Signed URL (first 100): {signedUrl[..100]}...");
Console.WriteLine($"  Expires in: 15 minutes");

// Access with no authentication
var httpClient2 = new HttpClient();
var resp = await httpClient.GetAsync(signedUrl);
var body = await resp.Content.ReadAsStringAsync();
Console.WriteLine($"  GET response: {resp.StatusCode}");
Console.WriteLine($"  Content size: {body.Length} bytes");
Console.WriteLine($"  First line:   {body.Split('\n')[0]}");
```

      Signed URL (first 100): https://storage.googleapis.com/seclab-dev-ap-26-data/bronze/csv/dim_index.csv?X-Goog-Algorithm=GOOG4...
      Expires in: 15 minutes
      GET response: OK
      Content size: 245 bytes
      First line:   index_key,display_name,file_prefix,color,currency

## Security Operations Audit Summary

> [!abstract]- Security Operations Audit Summary (C#)
>
> **Identity & Authentication:** SA key file (`ServiceAccountCredential`), ADC, service account impersonation, short-lived access tokens
>
> **Secret Manager:** Read/create/rotate/disable secrets, JSON secret parsing
>
> **Cloud KMS:** Symmetric encrypt/decrypt, envelope encryption with `AesGcm` (built-in .NET), key versioning
>
> **Cloud SQL:** `SqlClient` native TLS, CRUD with parameterized queries, SSL cert verification, `SqlBulkCopy` (in-process bulk insert), CMEK verification
>
> **BigQuery:** SA-authenticated queries, column-level KMS encryption + decryption
>
> **Firestore:** SA-authenticated CRUD, field-level KMS encryption
>
> **Cloud Storage:** CMEK upload/verify, client-side AES-GCM (built-in .NET), signed URLs with `UrlSigner`
>
> **C# advantages:** `SqlClient` is native (not FreeTDS), `SqlBulkCopy` streams directly (no temp files), `AesGcm` built into `System.Security.Cryptography`, compile-time type safety
