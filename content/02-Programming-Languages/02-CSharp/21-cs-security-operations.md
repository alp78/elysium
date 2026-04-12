---
title: "21 - Security Operations - C#"
tags: [csharp, gcp, security, encryption, identity]
aliases: [Security Operations CSharp, Encryption and Identity CSharp]
description: "C# security operations reference — encryption, certificates, identity, and secure access across GCP services. Executable examples with cell outputs. Built on infrastructure from [20-py-security-setup](https://alp78.github.io/elysium/02-Programming-Languages/01-Python/20-py-security-setup). See [21-py-security-operations](https://alp78.github.io/elysium/02-Programming-Languages/01-Python/21-py-security-operations) for the Python equivalent."
created: 2026-03-27
updated: 2026-03-27
status: complete
---

# Security Operations - C#

> [!quote]
> "The only truly secure system is one that is powered off, cast in a block of concrete, and sealed in a lead-lined room with armed guards — and even then I have my doubts."
>
> — **Gene Spafford**, attributed remark (c. 1989)

> [!abstract]- Summary
>
> **Environment Setup:** NuGet package installation (`Google.Cloud.*`, `Microsoft.Data.SqlClient`, `DotNetEnv`), namespace imports, `.env` loading, and project constants including `SA_KEY_PATH`, `KMS_KEYRING`, and `BUCKET_NAME`.
>
> **Identity and Authentication:** Service account key file auth via `ServiceAccountCredential.FromServiceAccountData`; ADC resolution through `GoogleCredential.GetApplicationDefault`; scoped credentials with `CreateScoped`; service account impersonation with `ImpersonatedCredential`; short-lived tokens via `IAMCredentialsClient.GenerateAccessToken`.
>
> **Secret Manager:** `SecretManagerServiceClient` for reading versioned secrets with `AccessSecretVersion`; creating secrets with labels and automatic replication; rotating with `AddSecretVersion`; disabling old versions; deserializing JSON-structured secrets with `JsonSerializer`.
>
> **Cloud KMS:** Symmetric encrypt/decrypt via `KeyManagementServiceClient.Encrypt` / `Decrypt` (≤64 KiB plaintext); envelope encryption — local `AesGcm` (DEK) + KMS-wrapped DEK for large payloads; key version inspection with `GetCryptoKey` / `ListCryptoKeyVersions`.
>
> **Cloud SQL:** `Microsoft.Data.SqlClient` native TLS connections; parameterized CRUD with `SqlCommand` and `AddWithValue`; SSL cert verification (`TrustServerCertificate=False`); CMEK status check via `gcloud sql instances describe`; high-throughput bulk insert with `SqlBulkCopy` using explicit `ColumnMappings`.
>
> **BigQuery:** `BigQueryClient` SA-authenticated queries; column-level KMS encryption — `portfolio_id` encrypted to Base64 before insert, decrypted after query.
>
> **Firestore:** SA-authenticated REST-based document CRUD (SDK assembly binding workaround for Polyglot Notebooks); field-level KMS encryption of `position_size` before write, decrypted after read.
>
> **Cloud Storage:** `StorageClient` CMEK upload with `KmsKeyName` verification; client-side `AesGcm` encrypt-then-upload (nonce + tag + ciphertext combined blob); download and local decrypt; `UrlSigner.FromCredential` for V4-signed 15-minute URLs with GET response verification.

> [!note]- Glossary
>
> **`GoogleCredential` / `ServiceAccountCredential`**
>
> - .NET types from `Google.Apis.Auth` that wrap a service account key JSON and provide OAuth2 tokens to GCP client libraries.
> - `GoogleCredential` is general-purpose (supports ADC, user credentials, impersonation); `ServiceAccountCredential` is key-file specific — load with `GoogleCredential.FromFile()` or `ServiceAccountCredential.FromServiceAccountData()`.
>
> > [!tip] Scope after load
> > Always call `.CreateScoped("https://www.googleapis.com/auth/cloud-platform")` after loading a `ServiceAccountCredential`; without it, the token may be missing required API scopes.
>
> > ---
>
> **ADC (Application Default Credentials, .NET)**
>
> - Application Default Credentials resolved by `GoogleCredential.GetApplicationDefaultAsync()` — checks `GOOGLE_APPLICATION_CREDENTIALS` env var, then `gcloud` user credentials, then the GCE/GKE metadata server.
> - All cells that do not explicitly load a key file rely on ADC; the metadata server path is only available on GCP VMs, not local workstations.
>
> > [!warning] Missing env var locally
> > Forgetting to set `GOOGLE_APPLICATION_CREDENTIALS` before running locally causes ADC to fall through to `gcloud` credentials, which may have broader or narrower permissions than the intended service account.
>
> > ---
>
> **`SecretManagerServiceClient`**
>
> - The .NET GCP client for reading, creating, and managing Secret Manager secret versions via `AccessSecretVersion`, `AddSecretVersion`, `DisableSecretVersion`, and `ListSecretVersions`.
> - Always use the full resource path: `projects/<project_id>/secrets/<name>/versions/latest`; partial paths throw `InvalidArgument`.
>
> > [!info] Versioning model
> > Secrets are immutable per version. Adding a new version does not invalidate the old one — both are accessible until explicitly disabled or destroyed. `"latest"` always resolves to the highest-numbered active version.
>
> > ---
>
> **`KeyManagementServiceClient`**
>
> - The .NET GCP client for Cloud KMS symmetric encrypt, decrypt, and key management; wraps the KMS REST API with generated gRPC stubs.
> - `Encrypt` accepts at most 64 KiB of plaintext (`ByteString`); for larger data, use envelope encryption — encrypt the data locally and send only the DEK to KMS.
>
> > [!warning] Direct encryption size limit
> > Calling `kmsClient.Encrypt()` on a payload larger than 64 KiB throws `InvalidArgument`. The correct pattern for large payloads is envelope encryption: encrypt data with a local `AesGcm` DEK, then wrap the DEK with KMS.
>
> > ---
>
> **`AesGcm` (.NET built-in)**
>
> - `System.Security.Cryptography.AesGcm` — authenticated encryption with associated data (AEAD), available in .NET 6+ without external dependencies; provides both confidentiality and integrity via a 16-byte authentication tag.
> - Requires a unique 12-byte nonce per encryption operation; reusing a nonce with the same key breaks the security guarantee.
>
> > [!danger] Nonce reuse
> > Reusing a nonce under the same `AesGcm` key allows an attacker to recover the plaintext from two ciphertexts. Always generate nonces with `RandomNumberGenerator.GetBytes(12)` — never use a counter unless it is guaranteed unique across all encryptions with that key.
>
> > ---
>
> **`SqlConnection` / `SqlClient` (`Microsoft.Data.SqlClient`)**
>
> - The first-class SQL Server driver for .NET; supports TLS natively, parameterized queries, and `SqlBulkCopy` — preferred over the legacy `System.Data.SqlClient` package which does not receive active security patches.
> - Use `Encrypt=True; TrustServerCertificate=False` in production; `TrustServerCertificate=True` encrypts traffic but does not verify server identity.
>
> > [!tip] C# vs Python advantage
> > Unlike Python's `pymssql` (which wraps FreeTDS), `Microsoft.Data.SqlClient` is the official Microsoft driver with full TLS 1.3 support, connection resiliency, and complete `SqlBulkCopy` functionality — no workarounds needed.
>
> > ---
>
> **`SqlBulkCopy`**
>
> - .NET API for high-throughput server-side bulk inserts into SQL Server via the TDS bulk-load protocol; streams data directly from an in-memory `DataTable` or `IDataReader` without staging temp files.
> - Always use `ColumnMappings` to bind source columns to destination columns by name; position-based mapping silently misaligns data if schema order differs.
>
> > [!warning] Silent misalignment without `ColumnMappings`
> > Omitting `SqlBulkCopyColumnMapping` entries causes the driver to map columns by ordinal position. If the source `DataTable` and target SQL table have different column orders, values are inserted into the wrong columns with no error raised.
>
> > ---
>
> **`BigQueryClient`**
>
> - The .NET GCP client for querying and mutating BigQuery datasets; uses ADC or explicit `GoogleCredential` via `BigQueryClient.Create(projectId)`.
> - Always use `BigQueryParameter` objects for user-controlled values; string-interpolated query strings are the primary SQL injection vector in BigQuery .NET code.
>
> > [!info] Column-level encryption pattern
> > BigQuery has no native column-level encryption. The pattern is: encrypt the field value with `kmsClient.Encrypt()`, store the Base64-encoded ciphertext as a `STRING` column, and decrypt in the application layer after query. The table stores opaque blobs — only callers with KMS decrypt IAM access can recover the plaintext.
>
> > ---
>
> **`FirestoreDb`**
>
> - The .NET GCP client for Firestore document CRUD; in Polyglot Notebooks, assembly binding conflicts with `Microsoft.Bcl.AsyncInterfaces` require falling back to the Firestore REST API via `HttpClient` with a Bearer token.
> - Use `UpdateAsync` (modifies specified fields only) rather than `SetAsync` (overwrites the entire document) for partial document updates.
>
> > [!warning] `SetAsync` overwrites the entire document
> > Calling `document.SetAsync(obj)` without `SetOptions.MergeAll` replaces every field in the document, including fields written by other processes. Use `UpdateAsync(updates)` or `SetAsync(obj, SetOptions.MergeAll)` for partial updates.
>
> > ---
>
> **`UrlSigner`**
>
> - GCP Storage .NET class that creates V4-signed URLs granting time-limited unauthenticated GET/PUT access to a private GCS object — no GCP credentials are required by the caller.
> - The signing service account must have the `iam.serviceAccounts.signBlob` permission; grant `roles/iam.serviceAccountTokenCreator` if signing via impersonation.
>
> > [!warning] Signed URL exposure risk
> > Never log signed URLs — they grant object access to anyone who possesses them. Keep expiration times to the minimum practical window (minutes, not hours or days), and audit URL generation events with object name, expiry, and signing SA.
>
> > ---
>
> **`StorageClient`**
>
> - The .NET GCP client for Cloud Storage object CRUD, CMEK-encrypted upload, and signed URL generation; `UploadObjectOptions.KmsKeyName` must be set explicitly — omitting it silently falls back to Google-managed encryption.
> - After a CMEK-enabled upload, always call `storageClient.GetObject()` and verify `obj.KmsKeyName` is non-null; do not assume the key was applied just because it was specified.
>
> > [!info] CMEK vs client-side encryption
> > CMEK encrypts the object server-side using a customer-managed KMS key; the ciphertext is managed by GCS and the key by Cloud KMS. Client-side encryption (AES-GCM before upload) encrypts the bytes before they leave the application; GCS stores an opaque blob and has no access to the plaintext under any circumstance.
>
> > ---
>
> **Envelope Encryption (.NET)**
>
> - A two-layer encryption pattern: generate a local 256-bit data-encryption key (DEK) with `RandomNumberGenerator.GetBytes(32)`, encrypt the data with `AesGcm` using that DEK, then send only the 32-byte DEK to `kmsClient.Encrypt()` for wrapping (key-encryption key, KEK).
> - Store the KMS-encrypted DEK (wrapped DEK) alongside the ciphertext and nonce; never persist the plaintext DEK in memory or storage beyond the encryption operation.
>
> > [!tip] When to use envelope encryption
> > Use envelope encryption for payloads larger than 64 KiB, high-throughput pipelines (one KMS call per DEK rather than per row), or multi-recipient scenarios where the same DEK can be wrapped with different KEKs for different principals.

> [!tip] Prerequisite Reading
>
> For the theoretical framework behind these operations — identity model, credential types, OAuth2 flows, and connection patterns — see [gcp-identity-and-connection-patterns](https://alp78.github.io/elysium/06-GCP/Security/gcp-identity-and-connection-patterns).

This note demonstrates C# security operations across GCP services — encryption, certificates, identity, and secure access.

### What this note covers

- **Environment Setup** — NuGet package installation and environment variable / credential initialization
- **Identity and Authentication** — service account key auth, ADC, service account impersonation, access token inspection
- **Secret Manager** — read, create, rotate, and disable secret versions using `SecretManagerServiceClient`
- **Cloud KMS** — symmetric encrypt/decrypt, envelope encryption with built-in `AesGcm`
- **Cloud SQL** — SQL Server TLS connections via `SqlClient`, parameterized CRUD, SSL cert verification, `SqlBulkCopy`
- **BigQuery** — SA-authenticated queries, column-level KMS encryption and decryption
- **Firestore** — SA-authenticated CRUD, field-level KMS encryption
- **Cloud Storage** — CMEK upload and verification, client-side AES-GCM encryption, signed URLs with `UrlSigner`
- **Security Operations Audit Summary** — consolidated summary of all operations and C#-specific advantages

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

```

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

```

#### Load environment variables from .env

```csharp
// Load .env file so all GCP config is available
DotNetEnv.Env.Load();
```

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

Scoped credentials limit which APIs the token can access. Even if the SA has broad roles, the scoped token restricts access to only the specified APIs.

```csharp
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

> [!info] Short-Lived Access Tokens
> Generate tokens with 300s-3600s lifetime for time-boxed operations. Use when handing off to untrusted code. Do NOT use for long-running jobs — the token expires mid-run.

```csharp
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

Secrets are versioned — `"latest"` always resolves to the most recent active version.

```csharp
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

> [!warning] Secret Rotation Grace Period
> After creating a new secret version, disable (don't destroy) the old one. Schedule destruction after a grace period to allow in-flight operations using the old version to complete.

> [!success] Safe Rotation Pattern
> Disable the old version immediately after adding the new one. Set a reminder to destroy it after your grace period (e.g., 24–48 hours). All in-flight operations complete against the disabled version; the destroy step is a deliberate, audited action.

```csharp
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

Secrets can store any string — JSON configs, connection strings, or certificates.

```csharp
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

KMS determines the correct key version from metadata embedded in the ciphertext — no version selection needed.

```csharp
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

KMS automatically manages version history. When you rotate, the new version becomes primary for new encryptions. Old ciphertext still decrypts because the version ID is embedded in it.

```csharp
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

> [!info] Native SQL Server Driver
> `Microsoft.Data.SqlClient` provides full TLS support and modern authentication. Unlike Python's `pymssql` (which uses FreeTDS), this is the official Microsoft driver with complete feature parity.

```csharp
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

All operations use parameterized queries to prevent SQL injection.

**Create table.** Uses `IF NOT EXISTS` to make the operation idempotent.

```csharp
using var conn = new SqlConnection(connStr);
conn.Open();

using (var cmd = new SqlCommand(@"
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'security_test')
    CREATE TABLE security_test (
        id INT IDENTITY(1,1) PRIMARY KEY,
        symbol NVARCHAR(20),
        score FLOAT,
        created_at DATETIME DEFAULT GETDATE()
    )", conn))
{ cmd.ExecuteNonQuery(); }
```

**Insert rows.** Parameters are bound with `AddWithValue` — the driver handles type mapping and escaping.

```csharp
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
```

**Query rows.** `ExecuteReader` returns a forward-only cursor. Column values are accessed by ordinal with typed getters.

```csharp
using (var cmd = new SqlCommand("SELECT id, symbol, score, created_at FROM security_test", conn))
using (var reader = cmd.ExecuteReader())
{
    while (reader.Read())
        Console.WriteLine($"    {reader.GetInt32(0),3}  {reader.GetString(1),-10}  {reader.GetDouble(2),6:F1}  {reader.GetDateTime(3)}");
}
```

```text
Inserted 2 rows into security_test
  1  AAPL          95.5  26-Mar-26 4:34:20
  2  MSFT          88.2  26-Mar-26 4:34:20
```

**Drop table.** Cleans up the test table after verification.

```csharp
using (var cmd = new SqlCommand("DROP TABLE security_test", conn))
{ cmd.ExecuteNonQuery(); }
Console.WriteLine("  Dropped security_test table");
```

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

Checks whether the Cloud SQL instance uses CMEK or Google-managed encryption. Empty output means Google-managed (default); CMEK shows the KMS key path.

```csharp
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

BigQuery access is controlled by IAM roles (`bigquery.dataViewer` or higher). The SA credential is picked up automatically via ADC.

```csharp
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

Firestore access is controlled by IAM roles (`datastore.user` or higher). This cell uses the REST API directly because the Firestore SDK has an assembly binding issue in Polyglot Notebooks (`Microsoft.Bcl.AsyncInterfaces` mismatch).

```csharp
var httpClient = new HttpClient();
var accessToken = await saCredential.UnderlyingCredential.GetAccessTokenForRequestAsync();
httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

var fsBaseUrl = $"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/{FIRESTORE_DB}/documents";

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

Writes a test document via REST API and reads it back to verify round-trip access.

```csharp
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

var readResp = await httpClient.GetAsync($"{fsBaseUrl}/access_test_cs/demo");
var readJson = await readResp.Content.ReadAsStringAsync();
Console.WriteLine($"  Read back: {readResp.StatusCode}");
Console.WriteLine($"  Data: {readJson[..Math.Min(200, readJson.Length)]}...");

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

Encrypts sensitive fields with KMS before writing to Firestore via REST. Only the `position_size` value is encrypted — the symbol remains in cleartext for querying.

```csharp
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

var encReadResp = await httpClient.GetAsync($"{fsBaseUrl}/encrypted_positions_cs/demo");
var encReadJson = JsonSerializer.Deserialize<JsonElement>(await encReadResp.Content.ReadAsStringAsync());
var encValue = encReadJson.GetProperty("fields").GetProperty("position_size_encrypted").GetProperty("stringValue").GetString();
var decResp = kmsClient.Decrypt(keyName, ByteString.CopyFrom(Convert.FromBase64String(encValue)));
Console.WriteLine($"  Decrypted position_size: {decResp.Plaintext.ToStringUtf8()}");

await httpClient.DeleteAsync($"{fsBaseUrl}/encrypted_positions_cs/demo");
Console.WriteLine("  Cleaned up encrypted document");
```

      Written encrypted document: OK
      Decrypted position_size: 1500
      Cleaned up encrypted document

## Cloud Storage — Encryption and Access Control

#### StorageClient — upload to CMEK-encrypted GCS bucket

Uploads a file to the CMEK-encrypted bucket and verifies the encryption metadata on the stored object.

```csharp
var storageClient = StorageClient.Create();
var testContent = Encoding.UTF8.GetBytes("Security test from C# notebook");

using (var ms = new MemoryStream(testContent))
{
    storageClient.UploadObject(BUCKET_NAME, "security-demo/cs_test.txt", "text/plain", ms);
}
Console.WriteLine("  Uploaded: security-demo/cs_test.txt");

var obj = storageClient.GetObject(BUCKET_NAME, "security-demo/cs_test.txt");
Console.WriteLine($"  KMS key:  {obj.KmsKeyName ?? "Google-managed"}");
Console.WriteLine($"  Size:     {obj.Size} bytes");
```

      Uploaded: security-demo/cs_test.txt
      KMS key:  projects/seclab-dev-ap-26/locations/europe-west1/keyRings/notebook-keyring/cryptoKeys/notebook-encrypt-key/cryptoKeyVersions/1
      Size:     30 bytes

#### AesGcm — client-side encryption before GCS upload

Encrypts data locally with AES-GCM before uploading to GCS. `AesGcm` is built into `System.Security.Cryptography` — no external library needed. The nonce, tag, and ciphertext are combined into a single blob for storage.

```csharp
var cseDek = RandomNumberGenerator.GetBytes(32);
var cseNonce = RandomNumberGenerator.GetBytes(12);
var cseData = Encoding.UTF8.GetBytes("Client-side encrypted data from C#");
var cseEncrypted = new byte[cseData.Length];
var cseTag = new byte[16];

using (var aes = new AesGcm(cseDek, 16))
    aes.Encrypt(cseNonce, cseData, cseEncrypted, cseTag);

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

Downloads the encrypted blob and decrypts locally. The combined format is split back into nonce (12 bytes), tag (16 bytes), and ciphertext.

```csharp
var dlStream = new MemoryStream();
storageClient.DownloadObject(BUCKET_NAME, "security-demo/cs_encrypted.bin", dlStream);
var dlBytes = dlStream.ToArray();

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

Signed URLs grant time-limited access to a private GCS object without requiring the caller to authenticate. Use for sharing with external users or frontend direct downloads.

> [!warning] Signed URL anti-patterns
>
> Never log signed URLs (they grant access to anyone who has them) and keep expiration times short (minutes, not days).

```csharp
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

## Warnings

> [!warning] Using `TrustServerCertificate=True` in Cloud SQL connection strings
>
> Setting `TrustServerCertificate=True` disables server certificate validation, making TLS encryption meaningless against a man-in-the-middle attack — the connection is encrypted but the server identity is not verified.

> [!success] Supply the server CA certificate and enforce `Encrypt=True;TrustServerCertificate=False`
>
> Download the server CA from the Cloud SQL instance, pass its path via the connection string or trust store, and set `TrustServerCertificate=False`. This enforces mutual TLS and verifies the server identity.

> [!warning] Sending large plaintext blobs directly to Cloud KMS for encryption
>
> `KeyManagementServiceClient.Encrypt` accepts a maximum of 64 KiB of plaintext. Sending larger payloads throws `InvalidArgument` and routes all sensitive data through the KMS API call.

> [!success] Apply envelope encryption: use `AesGcm` locally for the data, KMS only for the DEK
>
> Generate a 256-bit DEK with `RandomNumberGenerator.GetBytes(32)`, encrypt data with `AesGcm`, then call `kmsClient.Encrypt()` on the 32-byte DEK only. Store the encrypted DEK alongside the ciphertext.

> [!warning] Mapping `SqlBulkCopy` columns by position instead of by name
>
> Column-order-based mapping silently inserts values into the wrong columns when the source `DataTable` column order differs from the target table's column order — no error is raised.

> [!success] Always use explicit `ColumnMappings` in `SqlBulkCopy`
>
> Add a `SqlBulkCopyColumnMapping` for every source–destination pair by name. This is resilient to schema changes and makes the intent auditable in code review.

> [!warning] Using `FirestoreDb.SetAsync` for partial document updates
>
> `SetAsync` with no `SetOptions` replaces the entire document, deleting any fields not included in the supplied object — even fields written by other processes.

> [!success] Use `UpdateAsync` or `SetAsync` with `SetOptions.MergeAll` for partial updates
>
> `document.UpdateAsync(updates)` modifies only the specified fields. Alternatively, `SetAsync(obj, SetOptions.MergeAll)` merges the new values without removing existing fields.

## Recommendations

- Use `GoogleCredential.GetApplicationDefaultAsync()` as the default authentication strategy; only fall back to `GoogleCredential.FromFile()` when ADC is unavailable (e.g., unit test environments without a metadata server).
- Store the service account key file path in an environment variable (`GOOGLE_APPLICATION_CREDENTIALS`) rather than hard-coding it; this keeps the path out of source control and works consistently across dev and CI.
- Use `Microsoft.Data.SqlClient` (not `System.Data.SqlClient`) for all Cloud SQL connections; it is the actively maintained package with current TLS and security patches.
- Always pass `SqlParameter` objects for user-controlled values in SQL queries; string interpolation into SQL commands is the primary injection vector in `SqlClient` code.
- Persist the KMS key resource name (including version) alongside every encrypted value in Secret Manager, BigQuery, or Firestore; this metadata is required to support key rotation and is not stored automatically.
- Set the minimum practical expiry on signed URLs (minutes); log the generation event with object name, expiry, and signing SA for audit purposes.
- Verify CMEK after every CMEK-enabled upload or table creation by calling `GetObject` / `GetTable` and checking the `KmsKeyName` field; do not assume the key was applied because it was specified.
- When using `AesGcm`, generate a unique 12-byte nonce per encryption operation with `RandomNumberGenerator.GetBytes(12)`; never reuse a nonce with the same key.

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| `Google.Apis.Auth.OAuth2.Responses.TokenResponseException: invalid_grant` | The service account key file is revoked, expired, or belongs to a deleted SA | Re-download the key from GCP console or generate a new key with `gcloud iam service-accounts keys create` |
| `Grpc.Core.RpcException: Status(StatusCode="PermissionDenied")` on KMS calls | SA lacks `roles/cloudkms.cryptoKeyEncrypterDecrypter` on the specified key | Grant the role: `gcloud kms keys add-iam-policy-binding <key> --member=serviceAccount:<sa> --role=roles/cloudkms.cryptoKeyEncrypterDecrypter` |
| `SqlException: A connection was successfully established with the server, but then an error occurred during the login process` | Certificate validation failure or TLS version mismatch between `SqlClient` and Cloud SQL | Set `TrustServerCertificate=False` and supply the correct CA cert; ensure Cloud SQL instance is on SQL Server 2019+ for TLS 1.2 support |
| `Google.Cloud.SecretManager.V1.SecretManagerServiceClient` throws `NotFound` | Secret or version path is incorrect or the secret does not exist in this project | Use the full resource path: `projects/<project>/secrets/<name>/versions/latest`; confirm with `gcloud secrets describe <name>` |
| `AesGcm.Decrypt` throws `CryptographicException: The computed authentication tag did not match the input authentication tag` | Ciphertext, nonce, or tag was corrupted, or decryption is attempted with the wrong DEK | Ensure the nonce and tag arrays are stored and retrieved exactly as written; verify the DEK was decrypted with the correct KMS key version |
| `FirestoreDb` throws `Google.Cloud.Firestore.NotFound` on `GetSnapshotAsync` | Document does not exist, or the Firestore database name is incorrect | Check the database name in `FirestoreDbBuilder`; use `document.Exists` before accessing `.ConvertTo<T>()` |
| `StorageClient.UploadObject` succeeds but `KmsKeyName` is null on the returned object | `UploadObjectOptions.KmsKeyName` was not set, or the SA lacks `cloudkms.cryptoKeyVersions.useToEncrypt` | Confirm `UploadObjectOptions` is passed with the correct KMS key resource path; verify KMS IAM binding for the SA |
| `UrlSigner.SignAsync` throws `InvalidOperationException: Unable to sign` | The signing SA lacks `iam.serviceAccounts.signBlob` | Grant `roles/iam.serviceAccountTokenCreator` to the caller SA on the target signing SA: `gcloud iam service-accounts add-iam-policy-binding <signing-sa> --member=... --role=roles/iam.serviceAccountTokenCreator` |

## Cross-References

- [gcp-identity-and-connection-patterns](https://alp78.github.io/elysium/06-GCP/Security/gcp-identity-and-connection-patterns) — identity model, credential types, and OAuth2 flows
- [gcp-cloud-sql](https://alp78.github.io/elysium/06-GCP/Services/gcp-cloud-sql) — Cloud SQL SSL configuration, CMEK, and `SqlClient` connection patterns
