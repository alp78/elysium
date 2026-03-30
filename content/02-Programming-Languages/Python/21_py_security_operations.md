---
type: reference
category: programming-languages
technology: [python, gcp]
tags: [python, gcp, security, encryption, identity]
aliases: [Security Operations Python, Encryption and Identity Python]
keywords: [encryption, KMS, Secret Manager, certificates, Workload Identity, OAuth, JWT, IAM, SSH, paramiko, Cloud SQL, BigQuery, Firestore, GCS, signed URLs, CMEK, CSEK, envelope encryption, IAP tunnel, service account impersonation]
description: "Python security operations reference — encryption, certificates, identity, and secure access across GCP services. Executable examples with cell outputs. Built on infrastructure from [[20_py_security_setup]]. See [[21_cs_security_operations]] for the C# equivalent."
related:
  - "[[moc-programming-languages]]"
  - "[[21_cs_security_operations]]"
  - "[[20_py_security_setup]]"
  - "[[17_py_gcp]]"
created: 2026-03-27
updated: 2026-03-27
status: complete
---

# 21. Security Operations — Encryption, Certificates & Identity

> [!tip] Prerequisite Reading
>
> For the theoretical framework behind these operations — identity model, credential types, OAuth2 flows, and connection patterns — see [gcp-identity-and-connection-patterns](/06-GCP/Security/gcp-identity-and-connection-patterns).

## Environment Setup

#### Import all libraries and verify versions

```python
# Import everything once — subsequent cells reuse these without re-importing

# Standard library
import base64
import datetime
from datetime import timedelta
import hashlib
import json
import os
from pathlib import Path
import socket
import ssl
import subprocess
import time

# Third-party
import paramiko
import pymssql
import requests as http_requests

# Cryptography
import cryptography
import OpenSSL
from cryptography import x509
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# Google Auth
import google.auth
import google.auth.transport.requests
from google.auth import impersonated_credentials
from google.oauth2 import service_account
from google.protobuf import duration_pb2

# Google Cloud — core services
from google.cloud import bigquery, compute_v1, firestore, kms, secretmanager, storage
from google.cloud import iam_credentials_v1, resourcemanager_v3
from google.cloud.secretmanager_v1.types import Replication, Secret, SecretPayload
from google.iam.v1 import iam_policy_pb2

# Environment
import secrets as secrets_module
from dotenv import load_dotenv

print("  Library versions:")
print(f"    google-auth:          {google.auth.__version__}")
print(f"    google-cloud-kms:     {kms.__version__}")
print(f"    google-cloud-storage: {storage.__version__}")
print(f"    cryptography:         {cryptography.__version__}")
print(f"    paramiko:             {paramiko.__version__}")
print(f"    pyopenssl:            {OpenSSL.__version__}")
```

      Library versions:
        google-auth:          2.49.1
        google-cloud-kms:     3.11.0
        google-cloud-storage: 3.9.0
        cryptography:         46.0.5
        paramiko:             4.0.0
        pyopenssl:            26.0.0

#### python-dotenv load_dotenv — load .env configuration

```python
# Load .env so all GCP config is available as env vars
load_dotenv(override=True)
print(f"  .env loaded: {os.path.exists('.env')}")
```

      .env loaded: True

#### Define project constants

```python
# Central config — every cell below references these constants
PROJECT_ID       = "seclab-dev-ap-26"
PROJECT_NUMBER   = "922174528852"
REGION           = "europe-west1"
ZONE             = "europe-west1-b"
SA_EMAIL         = "notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com"
SA_KEY_PATH      = os.environ["GCP_SA_KEY_PATH"]
KMS_LOCATION     = "europe-west1"
KMS_KEYRING      = "notebook-keyring"
KMS_KEY          = "notebook-encrypt-key"
BUCKET_NAME      = os.environ["GCP_BUCKET"]
SQL_INSTANCE     = os.environ["GCP_SQL_INSTANCE"]
SQL_IP           = os.environ["GCP_SQL_IP"]
SQL_PASSWORD     = os.environ["GCP_SQL_PASSWORD"]
BQ_DATASET       = "index_data"
FIRESTORE_DB     = "seclab-scores"
VM_NAME          = os.environ["GCP_VM_NAME"]
VM_EXTERNAL_IP   = "34.76.141.248"
SSH_KEY_PATH     = os.environ["SSH_KEY_PATH"]
GITHUB_REPO      = "alp78/security-lab"
WIF_POOL         = "github-pool"
WIF_PROVIDER     = "github-provider"

os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = SA_KEY_PATH
print(f"  Project:     {PROJECT_ID}")
print(f"  SA:          {SA_EMAIL}")
print(f"  Credentials: {SA_KEY_PATH} (exists: {os.path.exists(SA_KEY_PATH)})")
```

      Project:     seclab-dev-ap-26
      SA:          notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      Credentials: ./gcp-sa-key.json (exists: True)

#### google-auth credentials.refresh — verify GCP authentication

```python
# Confirm credentials are valid before proceeding with any operations
credentials = service_account.Credentials.from_service_account_file(
    SA_KEY_PATH,
    scopes=["https://www.googleapis.com/auth/cloud-platform"]
)

# Force a token refresh to validate
auth_request = google.auth.transport.requests.Request()
credentials.refresh(auth_request)

print(f"  Authenticated as:  {credentials.service_account_email}")
print(f"  Token valid:       {credentials.valid}")
print(f"  Token expiry:      {credentials.expiry}")
```

      Authenticated as:  notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      Token valid:       True
      Token expiry:      2026-03-26 04:40:02.725789

## Identity and Authentication

> **Security Note:** This section demonstrates every GCP authentication method.
> In production, prefer Workload Identity Federation or metadata-based credentials.
> Service account JSON keys should be a last resort and must be rotated regularly.

#### GCP Authentication Methods — Comparison

| Method | How it works | Best for | Avoid when |
|---|---|---|---|
| **Application Default Credentials (ADC)** | SDK checks env, metadata server, gcloud config in order | Local dev with `gcloud auth application-default login`; any code that should work identically in dev and prod | You need explicit control over which identity is used |
| **Metadata server (GCE/GKE/Cloud Run)** | VM or pod automatically gets a token from the instance metadata endpoint — no key file needed | Any workload running on GCP infrastructure | Running outside GCP (no metadata server available) |
| **Workload Identity Federation (WIF)** | External OIDC/SAML token (GitHub Actions, AWS, Azure AD) is exchanged for a short-lived GCP token via STS — no key file | CI/CD pipelines, cross-cloud access, GitHub Actions | Environments that cannot issue a trusted OIDC token |
| **Service Account impersonation** | A caller identity assumes another SA's permissions for a scoped operation | Least-privilege delegation; testing what a SA can do without holding its key | Permanent elevation — use short TTLs and audit regularly |
| **Service Account JSON key** | Long-lived private key downloaded and stored as a file | Last resort: legacy systems, local scripts with no other option | Anything running on GCP (use metadata server instead); any shared or automated environment (rotation is manual and error-prone) |
| **Short-lived access tokens** | `generateAccessToken` issues a token valid for 1 h max | Time-boxed operations, token hand-off to untrusted code | Long-running background jobs (token expires mid-run) |

#### Decision flow
1. Running on GCP compute? → **Metadata server** (attach the right SA to the resource)
2. Running in CI/CD or another cloud? → **Workload Identity Federation**
3. Need to act as a different SA temporarily? → **Impersonation**
4. Local development only? → **ADC via gcloud**
5. None of the above? → **SA JSON key** (rotate every 90 days, store in Secret Manager)

#### google-auth Credentials.from_service_account_file — key file authentication

```python
# Authenticate using a downloaded JSON key file — the most explicit method
# This loads the private key and signs JWTs to obtain access tokens
sa_credentials = service_account.Credentials.from_service_account_file(
    SA_KEY_PATH,
    scopes=["https://www.googleapis.com/auth/cloud-platform"]
)

print(f"  SA email:    {sa_credentials.service_account_email}")
print(f"  Project:     {sa_credentials.project_id}")
print(f"  Scoped:      {sa_credentials.scopes}")
```

      SA email:    notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      Project:     seclab-dev-ap-26
      Scoped:      ['https://www.googleapis.com/auth/cloud-platform']

#### google-auth credentials.with_scopes — restrict API access

```python
# Scoped credentials limit which APIs the token can access
# Even if the SA has broad roles, scoped tokens restrict the blast radius
readonly_scopes = ["https://www.googleapis.com/auth/cloud-platform.read-only"]
readonly_creds = sa_credentials.with_scopes(readonly_scopes)

auth_req = google.auth.transport.requests.Request()
readonly_creds.refresh(auth_req)

print(f"  Scopes:      {readonly_creds.scopes}")
print(f"  Token valid: {readonly_creds.valid}")
print(f"  Token (first 20): {readonly_creds.token[:20]}...")
```

      Scopes:      ['https://www.googleapis.com/auth/cloud-platform.read-only']
      Token valid: True
      Token (first 20): ya29.c.c0AZ4bNpZ6cVv...

#### google-cloud-resourcemanager ProjectsClient — list IAM roles

```python
# Use the authenticated credentials to call the IAM API
# This proves the SA key works and has project-level access

try:
    rm_client = resourcemanager_v3.ProjectsClient(credentials=sa_credentials)
    project = rm_client.get_project(name=f"projects/{PROJECT_ID}")
    print(f"  Project:  {project.project_id}")
    print(f"  Name:     {project.display_name}")
    print(f"  State:    {project.state.name}")
except Exception as e:
    # Fallback — list IAM policy via gcloud
    print(f"  Resource Manager check: {e}")
    print("  Falling back to gcloud...")
    !gcloud projects describe {PROJECT_ID} --format="value(name, projectId, lifecycleState)"
```

      Project:  seclab-dev-ap-26
      Name:     Security Lab
      State:    ACTIVE

> **Security Note:** JSON key files are the **least secure** authentication method.
> Risks: key leakage via git commits, no automatic rotation, no audit trail of key usage.
> Always prefer Workload Identity Federation, metadata server, or impersonation.

#### google.auth.default — Application Default Credentials (ADC) lookup chain

ADC checks credentials in order: (1) `GOOGLE_APPLICATION_CREDENTIALS` env var → SA key file, (2) `gcloud auth application-default login` → user credentials, (3) Compute Engine metadata server → VM identity, (4) Workload Identity Federation → external identity.

```python
adc_credentials, adc_project = google.auth.default(
    scopes=["https://www.googleapis.com/auth/cloud-platform"]
)

print(f"  ADC credential type: {type(adc_credentials).__name__}")
print(f"  ADC project:         {adc_project}")
print(f"  Source:              GOOGLE_APPLICATION_CREDENTIALS={os.environ.get('GOOGLE_APPLICATION_CREDENTIALS', 'not set')}")
print()
print("  ADC lookup chain:")
print("    1. GOOGLE_APPLICATION_CREDENTIALS env var  ← ACTIVE (SA key file)")
print("    2. gcloud CLI user credentials")
print("    3. Compute Engine metadata server")
print("    4. Workload Identity Federation config")
```

      ADC credential type: Credentials
      ADC project:         seclab-dev-ap-26
      Source:              GOOGLE_APPLICATION_CREDENTIALS=./gcp-sa-key.json
    
      ADC lookup chain:
        1. GOOGLE_APPLICATION_CREDENTIALS env var  ← ACTIVE (SA key file)
        2. gcloud CLI user credentials
        3. Compute Engine metadata server
        4. Workload Identity Federation config

#### Service account impersonation — keyless authentication

Impersonation: act as another SA without holding its key. The source requests a short-lived token for the target — requires `roles/iam.serviceAccountTokenCreator`. Use for: dev testing production SA access, CI/CD escalation, cross-project access, local development matching production behavior.

> [!warning] Impersonation anti-patterns
>
> - Granting `serviceAccountTokenCreator` at project level — scope to specific SAs
> - Using impersonation for long-running workloads — prefer WIF or attached SA
> - Not auditing who can impersonate — `tokenCreator` is effectively "become this identity"

```python
source_credentials, _ = google.auth.default(
    scopes=["https://www.googleapis.com/auth/cloud-platform"]
)

impersonated_creds = impersonated_credentials.Credentials(
    source_credentials=source_credentials,
    target_principal=SA_EMAIL,
    target_scopes=["https://www.googleapis.com/auth/cloud-platform"],
    lifetime=3600
)

# Force a token refresh to prove impersonation works
auth_req = google.auth.transport.requests.Request()
impersonated_creds.refresh(auth_req)

print(f"  Source identity:       {getattr(source_credentials, 'service_account_email', 'user')}")
print(f"  Impersonating:         {impersonated_creds.service_account_email}")
print(f"  Token valid:           {impersonated_creds.valid}")
print(f"  Token expiry:          {impersonated_creds.expiry}")
```

      Source identity:       notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      Impersonating:         notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      Token valid:           True
      Token expiry:          2026-03-26 04:56:17

#### google-cloud-storage Client — list GCS buckets with impersonated credentials

```python
# Prove impersonated credentials work by calling a real API
storage_client = storage.Client(
    project=PROJECT_ID,
    credentials=impersonated_creds
)

buckets = list(storage_client.list_buckets())
print(f"  Buckets accessible via impersonation ({len(buckets)}):")
for b in buckets:
    print(f"    gs://{b.name}  (location: {b.location})")
```

      Buckets accessible via impersonation (1):
        gs://seclab-dev-ap-26-data  (location: EUROPE-WEST1)

#### google-cloud-iam-credentials — generate short-lived OAuth2 access tokens

Short-lived access token (300s–3600s) for time-boxed operations. A leaked token has a bounded damage window. Use for: handing off to untrusted code, time-boxing sensitive ops, CI jobs without long-lived keys. Don't use for long-running jobs (token expires mid-run) or as a replacement for WIF (it already issues short-lived tokens).

```python
iam_client = iam_credentials_v1.IAMCredentialsClient(credentials=sa_credentials)

token_response = iam_client.generate_access_token(
    name=f"projects/-/serviceAccounts/{SA_EMAIL}",
    scope=["https://www.googleapis.com/auth/cloud-platform"],
    lifetime=duration_pb2.Duration(seconds=600)
)

short_token = token_response.access_token
token_expiry = token_response.expire_time

print(f"  Token (first 30):  {short_token[:30]}...")
print(f"  Expires at:        {token_expiry}")
print(f"  Lifetime:          600 seconds")
```

      Token (first 30):  ya29.c.c0AZ4bNpbofv3VOpJ9-P6A0...
      Expires at:        2026-03-26 01:32:01+00:00
      Lifetime:          600 seconds

#### requests + Bearer token — call GCP REST API with raw access token

```python
# Use the short-lived token to call the GCP REST API directly — no SDK needed
# This demonstrates that the token is a standard OAuth2 bearer token
response = http_requests.get(
    f"https://storage.googleapis.com/storage/v1/b/{BUCKET_NAME}",
    headers={"Authorization": f"Bearer {short_token}"}
)

if response.status_code == 200:
    bucket_info = response.json()
    print(f"  Bucket:       {bucket_info['name']}")
    print(f"  Location:     {bucket_info['location']}")
    print(f"  Storage class: {bucket_info['storageClass']}")
    print(f"  Encryption:   {bucket_info.get('encryption', {}).get('defaultKmsKeyName', 'Google-managed')}")
else:
    print(f"  Error {response.status_code}: {response.text[:200]}")
```

      Bucket:       seclab-dev-ap-26-data
      Location:     EUROPE-WEST1
      Storage class: STANDARD
      Encryption:   projects/seclab-dev-ap-26/locations/europe-west1/keyRings/notebook-keyring/cryptoKeys/notebook-encrypt-key

#### Workload Identity Federation — GitHub Actions OIDC flow

Workload Identity Federation allows external identities (GitHub, AWS, Azure) to authenticate to GCP without SA keys. Flow: GitHub OIDC token → Google STS → GCP access token.

```python
print("  Workload Identity Federation Configuration:")
print(f"    Pool:           {WIF_POOL}")
print(f"    Provider:       {WIF_PROVIDER}")
print(f"    Issuer:         https://token.actions.githubusercontent.com")
print(f"    Target SA:      {SA_EMAIL}")
print(f"    Bound repo:     {GITHUB_REPO}")
print()


# Verify the pool exists
r = subprocess.run(
    ["gcloud", "iam", "workload-identity-pools", "describe", WIF_POOL,
     "--location=global", "--project", PROJECT_ID,
     "--format=value(displayName,state)"],
    capture_output=True, text=True, shell=True
)
if r.returncode == 0:
    print(f"  Pool:     {r.stdout.strip()}")
else:
    print(f"  Pool not accessible from this identity")

# Verify the provider exists
r = subprocess.run(
    ["gcloud", "iam", "workload-identity-pools", "providers", "describe", WIF_PROVIDER,
     "--workload-identity-pool", WIF_POOL,
     "--location=global", "--project", PROJECT_ID,
     "--format=value(displayName,state)"],
    capture_output=True, text=True, shell=True
)
if r.returncode == 0:
    print(f"  Provider: {r.stdout.strip()}")
else:
    print(f"  Provider not accessible from this identity")
```

      Workload Identity Federation Configuration:
        Pool:           github-pool
        Provider:       github-provider
        Issuer:         https://token.actions.githubusercontent.com
        Target SA:      notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
        Bound repo:     alp78/security-lab
    
      Pool:     GitHub Actions Pool	ACTIVE
      Provider: ACTIVE

#### GitHub Actions workflow for Workload Identity Federation

```python
# Generate a GitHub Actions workflow YAML that authenticates to GCP using WIF
# This replaces SA key files in CI/CD pipelines
wif_workflow = f"""
name: GCP Security Lab — WIF Demo
on:
  workflow_dispatch:

permissions:
  id-token: write    # Required for OIDC token request
  contents: read

jobs:
  gcp-auth:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - id: auth
        name: Authenticate to GCP via Workload Identity Federation
        uses: google-github-actions/auth@v2
        with:
          project_id: {PROJECT_ID}
          workload_identity_provider: >-
            projects/{PROJECT_NUMBER}/locations/global/workloadIdentityPools/{WIF_POOL}/providers/{WIF_PROVIDER}
          service_account: {SA_EMAIL}

      - name: Verify GCP access
        run: |
          gcloud auth list
          gcloud projects describe {PROJECT_ID}
          gcloud storage ls gs://{BUCKET_NAME}

      - name: Query BigQuery
        run: |
          bq query --use_legacy_sql=false \\
            'SELECT COUNT(*) as rows FROM `{PROJECT_ID}.{BQ_DATASET}.gold_scores`'
"""

print(wif_workflow)

# Save to file for reference
Path("wif-demo-workflow.yml").write_text(wif_workflow.strip())
print("  Saved to: wif-demo-workflow.yml")
```

    
    name: GCP Security Lab — WIF Demo
    on:
      workflow_dispatch:
    
    permissions:
      id-token: write    # Required for OIDC token request
      contents: read
    
    jobs:
      gcp-auth:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
    
          - id: auth
            name: Authenticate to GCP via Workload Identity Federation
            uses: google-github-actions/auth@v2
            with:
              project_id: seclab-dev-ap-26
              workload_identity_provider: >-
                projects/922174528852/locations/global/workloadIdentityPools/github-pool/providers/github-provider
              service_account: notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
    
          - name: Verify GCP access
            run: |
              gcloud auth list
              gcloud projects describe seclab-dev-ap-26
              gcloud storage ls gs://seclab-dev-ap-26-data
    
          - name: Query BigQuery
            run: |
              bq query --use_legacy_sql=false \
                'SELECT COUNT(*) as rows FROM `seclab-dev-ap-26.index_data.gold_scores`'
    
      Saved to: wif-demo-workflow.yml

#### ID tokens versus access tokens — JWT structure

```python
# ID Token: proves WHO you are (identity assertion, used for service-to-service auth)
# Access Token: proves WHAT you can do (authorization, used for API access)

# Generate an ID token for a target audience
iam_client = iam_credentials_v1.IAMCredentialsClient(credentials=sa_credentials)

id_token_response = iam_client.generate_id_token(
    name=f"projects/-/serviceAccounts/{SA_EMAIL}",
    audience=f"https://{PROJECT_ID}.example.com",
    include_email=True
)

id_token = id_token_response.token
print(f"  ID Token (first 50): {id_token[:50]}...")
print(f"  ID Token length:     {len(id_token)} chars")
```

      ID Token (first 50): eyJhbGciOiJSUzI1NiIsImtpZCI6ImExMGU1OGRmNTVlNzI4NT...
      ID Token length:     794 chars

#### base64 + json — decode and inspect JWT token claims

```python
# Decode a JWT without verification to inspect its claims
# JWTs have 3 parts: header.payload.signature (base64url-encoded)
def decode_jwt_part(part: str) -> dict:
    padding = 4 - len(part) % 4
    part += "=" * padding
    decoded = base64.urlsafe_b64decode(part)
    return json.loads(decoded)

parts = id_token.split(".")
header = decode_jwt_part(parts[0])
payload = decode_jwt_part(parts[1])

print("  JWT Header:")
for k, v in header.items():
    print(f"    {k}: {v}")

print()
print("  JWT Payload (claims):")
for k, v in payload.items():
    if k in ("iat", "exp"):
        v = f"{v} ({datetime.datetime.fromtimestamp(v, tz=datetime.timezone.utc).isoformat()})"
    print(f"    {k}: {v}")

print()
print("  Key differences:")
print("    ID Token:     iss, sub, aud, email, exp — identity assertion")
print("    Access Token: scope-based, opaque string — API authorization")
```

      JWT Header:
        alg: RS256
        kid: a10e58df55e728566ec56bda6eb3bd45439f35d7
        typ: JWT
    
      JWT Payload (claims):
        aud: https://seclab-dev-ap-26.example.com
        azp: 113293760076949989647
        email: notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
        email_verified: True
        exp: 1774486246 (2026-03-26T00:50:46+00:00)
        iat: 1774482646 (2026-03-25T23:50:46+00:00)
        iss: https://accounts.google.com
        sub: 113293760076949989647
    
      Key differences:
        ID Token:     iss, sub, aud, email, exp — identity assertion
        Access Token: scope-based, opaque string — API authorization

#### google-cloud-resourcemanager — test IAM permissions on a resource

```python
# testIamPermissions checks what a specific identity can do on a resource
# Useful for debugging access issues without actually calling the API

try:
    rm_client = resourcemanager_v3.ProjectsClient(credentials=sa_credentials)
    test_request = iam_policy_pb2.TestIamPermissionsRequest(
        resource=f"projects/{PROJECT_ID}",
        permissions=[
            "secretmanager.secrets.create",
            "secretmanager.secrets.get",
            "cloudkms.keyRings.list",
            "cloudkms.cryptoKeys.list",
            "storage.buckets.list",
            "storage.objects.create",
            "compute.instances.list",
            "bigquery.tables.getData",
            "datastore.entities.get",
            "iam.serviceAccounts.actAs",
        ]
    )
    response = rm_client.test_iam_permissions(request=test_request)
    print(f"  Permissions granted ({len(response.permissions)}):")
    for p in sorted(response.permissions):
        print(f"    ✓ {p}")
except Exception as e:
    print(f"  Permission test via API: {e}")
    print("  Falling back to gcloud check...")
    import subprocess
    r = subprocess.run(
        ["gcloud", "projects", "get-iam-policy", PROJECT_ID,
         "--flatten=bindings[].members",
         f"--filter=bindings.members:{SA_EMAIL}",
         "--format=table(bindings.role)"],
        capture_output=True, text=True, shell=True
    )
    print(r.stdout or r.stderr)
```

      Permissions granted (7):
        ✓ bigquery.tables.getData
        ✓ compute.instances.list
        ✓ datastore.entities.get
        ✓ secretmanager.secrets.create
        ✓ secretmanager.secrets.get
        ✓ storage.buckets.list
        ✓ storage.objects.create

## Secret Manager — Secure Secret Lifecycle

#### google-cloud-secret-manager access_secret_version — read secrets

```python
# Read secrets stored during project setup
# Secrets are versioned — 'latest' gets the most recent active version
sm_client = secretmanager.SecretManagerServiceClient(credentials=sa_credentials)

secret_names = ["test-api-key", "db-password", "db-config"]

for name in secret_names:
    secret_path = f"projects/{PROJECT_ID}/secrets/{name}/versions/latest"
    try:
        response = sm_client.access_secret_version(name=secret_path)
        value = response.payload.data.decode("utf-8")

        # Mask the value for display
        masked = value[:4] + "***" + value[-4:] if len(value) > 8 else "***"
        print(f"  {name:20s} version={response.name.split('/')[-1]:8s} value={masked}")
    except Exception as e:
        print(f"  {name:20s} ERROR: {e}")
```

      test-api-key         version=1        value=sk_t***2345
      db-password          version=1        value=EsgD***ass1
      db-config            version=1        value={"ho***xx"}

#### google-cloud-secret-manager — access a specific secret version

```python
# Pin to a specific version number instead of 'latest'
# Critical for reproducibility — 'latest' changes when new versions are added
version_path = f"projects/{PROJECT_ID}/secrets/test-api-key/versions/1"
response = sm_client.access_secret_version(name=version_path)

print(f"  Secret:   test-api-key")
print(f"  Version:  1")
print(f"  State:    {response.name}")
print(f"  Created:  {response.payload.data.decode('utf-8')[:8]}...")
```

      Secret:   test-api-key
      Version:  1
      State:    projects/922174528852/secrets/test-api-key/versions/1
      Created:  sk_test_...

#### Parse JSON secret — database config

```python
# Secrets can store any string — JSON configs, connection strings, certificates
secret_path = f"projects/{PROJECT_ID}/secrets/db-config/versions/latest"
response = sm_client.access_secret_version(name=secret_path)

db_config = json.loads(response.payload.data.decode("utf-8"))
print(f"  DB config (parsed JSON):")
for k, v in db_config.items():
    print(f"    {k}: {v}")
```

      DB config (parsed JSON):
        host: localhost
        port: 1434
        database: stoxx

#### google-cloud-secret-manager create_secret — labels and replication

Use Secret Manager for API keys, passwords, certificates shared across services. Labels enable IAM conditions (e.g., `sensitivity=high` in prod).

> [!danger] Never hardcode secrets in code,
>
> Never hardcode secrets in code, bake them into Docker images, or store them in GCS/BigQuery instead of Secret Manager.

```python
new_secret_id = "notebook-demo-secret"

try:
    secret = sm_client.create_secret(
        parent=f"projects/{PROJECT_ID}",
        secret_id=new_secret_id,
        secret=Secret(
            replication=Replication(automatic=Replication.Automatic()),
            labels={
                "environment": "lab",
                "created-by": "notebook-21",
                "sensitivity": "high",
            },
        ),
    )
    print(f"  Created: {secret.name}")
    print(f"  Labels:  {dict(secret.labels)}")
except Exception as e:
    if "ALREADY_EXISTS" in str(e):
        print(f"  Secret {new_secret_id} already exists — skipping creation")
    else:
        raise
```

      Created: projects/922174528852/secrets/notebook-demo-secret
      Labels:  {'sensitivity': 'high', 'environment': 'lab', 'created-by': 'notebook-21'}

#### google-cloud-secret-manager add_secret_version — secret rotation

Add a new version to replace the secret value — old versions stay accessible until disabled. Rotation limits blast radius of leaked credentials and satisfies compliance (SOC2, PCI-DSS).

Recommended frequency: API/SA keys 90 days, DB passwords 30–90 days, certificates before expiry (1 year max), KMS keys 1–3 years (automatic via rotation policy).

> [!warning] Don't rotate without updating consumers
>
> Don't rotate without updating consumers first (outages). Don't destroy old versions immediately (breaks services). Don't skip rotation because "it has never been leaked" — you wouldn't know.

```python
new_password = secrets_module.token_urlsafe(24)
parent = f"projects/{PROJECT_ID}/secrets/{new_secret_id}"

version = sm_client.add_secret_version(
    parent=parent,
    payload=SecretPayload(data=new_password.encode("utf-8"))
)

print(f"  New version:   {version.name.split("/")[-1]}")
print(f"  State:         {version.state.name}")
print(f"  Value (first 8): {new_password[:8]}...")
```

      New version:   2
      State:         ENABLED
      Value (first 8): A_t--tzM...

#### google-cloud-secret-manager — disable and destroy old versions

```python
# After rotation, disable the old version so it can't be accessed
# Then schedule destruction after a grace period

# List all versions
parent = f"projects/{PROJECT_ID}/secrets/{new_secret_id}"
versions = list(sm_client.list_secret_versions(parent=parent))

print(f"  Versions for {new_secret_id}:")
for v in versions:
    ver_num = v.name.split("/")[-1]
    print(f"    v{ver_num}: {v.state.name}")

# Disable version 1 if it exists and is enabled
if len(versions) > 1:
    v1_name = versions[-1].name
    try:
        disabled = sm_client.disable_secret_version(name=v1_name)
        print(f"  Disabled: {v1_name.split('/')[-1]} → {disabled.state.name}")
    except Exception as e:
        print(f"  Disable skipped: {e}")
```

      Versions for notebook-demo-secret:
        v2: ENABLED
        v1: ENABLED
      Disabled: 1 → DISABLED

#### google-cloud-secret-manager get_iam_policy — read secret IAM policy

```python
# Check who has access to a secret — important for audit and compliance

secret_resource = f"projects/{PROJECT_ID}/secrets/test-api-key"
policy = sm_client.get_iam_policy(request={"resource": secret_resource})

print(f"  IAM policy for test-api-key:")
if policy.bindings:
    for binding in policy.bindings:
        print(f"    Role: {binding.role}")
        for member in binding.members:
            print(f"      → {member}")
else:
    print("    No explicit bindings — access inherited from project-level roles")
```

      IAM policy for test-api-key:
        No explicit bindings — access inherited from project-level roles

#### Secret access patterns for applications

```python
# Pattern 1: Load secret at startup into environment variable
def load_secret_to_env(secret_id: str, env_var: str):
    """Load a secret from Secret Manager into an env var at startup."""
    path = f"projects/{PROJECT_ID}/secrets/{secret_id}/versions/latest"
    response = sm_client.access_secret_version(name=path)
    os.environ[env_var] = response.payload.data.decode("utf-8")
    return True

# Pattern 2: Lazy-load with caching and TTL
class SecretCache:
    """Cache secrets in memory with a TTL to avoid repeated API calls."""
    def __init__(self, ttl_seconds=300):
        self._cache = {}
        self._ttl = ttl_seconds

    def get(self, secret_id: str) -> str:
        now = time.time()
        if secret_id in self._cache:
            value, fetched_at = self._cache[secret_id]
            if now - fetched_at < self._ttl:
                return value
        path = f"projects/{PROJECT_ID}/secrets/{secret_id}/versions/latest"
        response = sm_client.access_secret_version(name=path)
        value = response.payload.data.decode("utf-8")
        self._cache[secret_id] = (value, now)
        return value

# Demo
cache = SecretCache(ttl_seconds=60)
api_key = cache.get("test-api-key")
print(f"  Cached secret (first 8): {api_key[:8]}...")
print(f"  Cache TTL:               60 seconds")
print()
print("  ✗ Anti-pattern: NEVER hardcode secrets in source code")
print('    password = "SecLabPass2026"  # ← WRONG')
print('    password = cache.get("db-password")  # ← CORRECT')
```

      Cached secret (first 8): sk_test_...
      Cache TTL:               60 seconds
    
      ✗ Anti-pattern: NEVER hardcode secrets in source code
        password = "SecLabPass2026"  # ← WRONG
        password = cache.get("db-password")  # ← CORRECT

## Cloud KMS — Encryption and Key Management

Cloud KMS manages cryptographic keys on Google-owned HSMs. Your application never handles the raw key material — it sends plaintext to KMS and gets back ciphertext, or vice versa.

#### Core concepts
- **Key ring** — logical grouping of keys, bound to a region; cannot be deleted
- **CryptoKey** — the named key inside a ring; has a rotation schedule and purpose (ENCRYPT_DECRYPT, SIGN, MAC)
- **Key version** — the actual key material; KMS rotates automatically and keeps old versions to decrypt legacy data
- **Envelope encryption** — KMS encrypts a short data encryption key (DEK), not your data directly; your app encrypts data locally with the DEK and stores only the encrypted DEK alongside the ciphertext

#### When to use KMS
- Encrypting sensitive fields before storing in BigQuery, GCS, or Firestore (CMEK or application-layer encryption)
- Signing artifacts, JWTs, or release binaries where you need an auditable, non-exportable signing key
- Key rotation with zero downtime — KMS keeps old versions active for decryption automatically
- Compliance requirements (FIPS 140-2 Level 3, HIPAA, PCI-DSS) that mandate HSM-backed keys

#### Anti-patterns
- Encrypting large payloads directly with KMS (`encrypt` has a 64 KB limit) — use envelope encryption instead
- Using the same key for all data across all environments — separate key rings per env (dev/staging/prod)
- Disabling automatic rotation and rotating manually — manual rotation is forgotten and auditors flag it
- Granting `cloudkms.cryptoKeyEncrypterDecrypter` at project level — bind to the specific key, not the whole project
- Destroying key versions before confirming all ciphertext has been re-encrypted — data becomes permanently unreadable

HSM = Hardware Security Module

A physical tamper-resistant chip dedicated to cryptographic operations. Key properties:

- Keys never leave the hardware — the chip performs encrypt/decrypt internally; software only sees the result, never the raw key bytes
- Tamper-evident — if someone tries to physically extract keys, the device zeroes them
FIPS 140-2 Level 3 certified — the standard regulators (PCI-DSS, HIPAA, etc.) require for key storage
- In Cloud KMS, Google owns and operates the HSMs in their data centers. When you use KMS, your keys live on those chips — you never download or touch the key material. This is the "non-exportable" guarantee.
- The alternative — storing keys in software (a file, env var, Secret Manager) — means the key bytes are in memory and could in principle be read by a compromised process. HSM removes that risk entirely.

#### google-cloud-kms encrypt — symmetric encryption of plaintext

KMS symmetric encryption — plaintext sent to KMS, encrypted server-side, ciphertext returned. Use for small values (<64 KB) where audit trail and automatic key rotation are needed. For payloads >64 KB or high-throughput paths, use envelope encryption instead.

```python
kms_client = kms.KeyManagementServiceClient(credentials=sa_credentials)

key_name = kms_client.crypto_key_path(PROJECT_ID, KMS_LOCATION, KMS_KEYRING, KMS_KEY)

plaintext = b"Sensitive financial data: EUROSTOXX50 daily returns"

encrypt_response = kms_client.encrypt(
    name=key_name,
    plaintext=plaintext
)

ciphertext = encrypt_response.ciphertext
print(f"  Key:              {KMS_KEY}")
print(f"  Plaintext:        {plaintext.decode()}")
print(f"  Ciphertext (b64): {base64.b64encode(ciphertext)[:60].decode()}...")
print(f"  Ciphertext size:  {len(ciphertext)} bytes")
```

      Key:              notebook-encrypt-key
      Plaintext:        Sensitive financial data: EUROSTOXX50 daily returns
      Ciphertext (b64): CiQAvMIMG7uKgzyIcAfrWoM0DVnV4jJC6rnouAWNwmx8MMBVtkYSXAA/1XLb...
      Ciphertext size:  132 bytes

#### google-cloud-kms decrypt — symmetric decryption of ciphertext

```python
# Decrypt the ciphertext back to plaintext using the same KMS key
# KMS embeds the key version in the ciphertext — no need to specify it
decrypt_response = kms_client.decrypt(
    name=key_name,
    ciphertext=ciphertext
)

decrypted = decrypt_response.plaintext
print(f"  Decrypted:        {decrypted.decode()}")
print(f"  Match:            {decrypted == plaintext}")
```

      Decrypted:        Sensitive financial data: EUROSTOXX50 daily returns
      Match:            True

#### cryptography AESGCM + google-cloud-kms — envelope encryption

Envelope encryption: generate a local DEK, encrypt data locally with AES-GCM, then wrap the DEK with KMS. Avoids the 64 KB limit on direct KMS encrypt. Data encrypted locally (no network round-trip); only the small DEK is sent to KMS once per session. Use for files, blobs, high-throughput paths.

```python
# Generate a 256-bit local Data Encryption Key (DEK)
dek = AESGCM.generate_key(bit_length=256)
print(f"  DEK (b64):        {base64.b64encode(dek)[:30].decode()}...")

# Encrypt the data locally with the DEK
nonce = os.urandom(12)
aesgcm = AESGCM(dek)
large_data = b"A" * 10_000
encrypted_data = aesgcm.encrypt(nonce, large_data, None)
print(f"  Data encrypted:   {len(encrypted_data)} bytes (from {len(large_data)} bytes)")

# Wrap the DEK with KMS (encrypt the DEK, not the data)
wrap_response = kms_client.encrypt(name=key_name, plaintext=dek)
wrapped_dek = wrap_response.ciphertext
print(f"  Wrapped DEK:      {len(wrapped_dek)} bytes")

# Store: encrypted_data + nonce + wrapped_dek
# To decrypt: unwrap DEK with KMS → decrypt data locally
print()
print("  Envelope encryption result:")
print(f"    Encrypted data:  {len(encrypted_data)} bytes")
print(f"    Nonce:           {len(nonce)} bytes")
print(f"    Wrapped DEK:     {len(wrapped_dek)} bytes")
print(f"    Total overhead:  {len(wrapped_dek) + len(nonce)} bytes")
```

      DEK (b64):        5o1STNFyaNci6znfcgmakgZR/+Ej8W...
      Data encrypted:   10016 bytes (from 10000 bytes)
      Wrapped DEK:      113 bytes
    
      Envelope encryption result:
        Encrypted data:  10016 bytes
        Nonce:           12 bytes
        Wrapped DEK:     113 bytes
        Total overhead:  125 bytes

#### cryptography AESGCM + google-cloud-kms — envelope decryption

```python
# Reverse the envelope: unwrap DEK with KMS, then decrypt data locally
# Step 1: Unwrap the DEK
unwrap_response = kms_client.decrypt(name=key_name, ciphertext=wrapped_dek)
recovered_dek = unwrap_response.plaintext

# Step 2: Decrypt data locally with the recovered DEK
aesgcm = AESGCM(recovered_dek)
recovered_data = aesgcm.decrypt(nonce, encrypted_data, None)

print(f"  DEK recovered:    {recovered_dek == dek}")
print(f"  Data decrypted:   {len(recovered_data)} bytes")
print(f"  Data matches:     {recovered_data == large_data}")
```

      DEK recovered:    True
      Data decrypted:   10000 bytes
      Data matches:     True

#### Encryption benchmark — latency for different payload sizes

```python
# Benchmark KMS encrypt/decrypt latency for various payload sizes
# Direct KMS encryption is limited to 64KB — larger payloads need envelope encryption
sizes = [1024, 10_240, 64_000]

print(f"  {'Size':>10s}  {'Encrypt (ms)':>12s}  {'Decrypt (ms)':>12s}")
print(f"  {'─'*10}  {'─'*12}  {'─'*12}")

for size in sizes:
    payload = os.urandom(min(size, 64000))

    # Encrypt
    t0 = time.time()
    enc = kms_client.encrypt(name=key_name, plaintext=payload)
    t_enc = (time.time() - t0) * 1000

    # Decrypt
    t0 = time.time()
    kms_client.decrypt(name=key_name, ciphertext=enc.ciphertext)
    t_dec = (time.time() - t0) * 1000

    print(f"  {size:>10,d}  {t_enc:>12.1f}  {t_dec:>12.1f}")

print()
print("  Note: >64KB payloads require envelope encryption (local DEK + KMS wrap)")
```

            Size  Encrypt (ms)  Decrypt (ms)
      ──────────  ────────────  ────────────
           1,024          72.2          65.2
          10,240          75.7          74.9
          64,000         139.9         133.2
    
      Note: >64KB payloads require envelope encryption (local DEK + KMS wrap)

#### google-cloud-kms + google-cloud-storage — encrypt and upload to GCS

Client-side encryption before GCS upload — provides double encryption (client KMS + server CMEK). Use when compliance requires encryption before data leaves your process (HIPAA, PCI-DSS) or when separating access (one team owns bucket, another owns KMS key). For files >64 KB, use envelope encryption.

```python
gcs_client = storage.Client(project=PROJECT_ID, credentials=sa_credentials)
bucket = gcs_client.bucket(BUCKET_NAME)

# Read a sample CSV from the bucket
source_blob = bucket.blob("bronze/csv/dim_index.csv")
original_data = source_blob.download_as_bytes()
print(f"  Source file:       bronze/csv/dim_index.csv ({len(original_data)} bytes)")

# Encrypt with KMS
enc_response = kms_client.encrypt(name=key_name, plaintext=original_data)

# Upload encrypted version
dest_blob = bucket.blob("encrypted/csv/dim_index.csv.enc")
dest_blob.upload_from_string(enc_response.ciphertext)
print(f"  Uploaded:          encrypted/csv/dim_index.csv.enc ({len(enc_response.ciphertext)} bytes)")
print(f"  Double encrypted:  client-side KMS + server-side CMEK")
```

      Source file:       bronze/csv/dim_index.csv (247 bytes)
      Uploaded:          encrypted/csv/dim_index.csv.enc (330 bytes)
      Double encrypted:  client-side KMS + server-side CMEK

#### google-cloud-storage + google-cloud-kms — download and decrypt from GCS

```python
# Download the encrypted file and decrypt it with KMS
enc_blob = bucket.blob("encrypted/csv/dim_index.csv.enc")
encrypted_content = enc_blob.download_as_bytes()

dec_response = kms_client.decrypt(name=key_name, ciphertext=encrypted_content)
recovered_content = dec_response.plaintext

print(f"  Downloaded:        {len(encrypted_content)} bytes (encrypted)")
print(f"  Decrypted:         {len(recovered_content)} bytes")
print(f"  Content matches:   {recovered_content == original_data}")
print()
print("  First 3 lines:")
for line in recovered_content.decode().split("\n")[:3]:
    print(f"    {line}")
```

      Downloaded:        330 bytes (encrypted)
      Decrypted:         247 bytes
      Content matches:   True
    
      First 3 lines:
        index_key,display_name,file_prefix,color,currency
        euro_stoxx_50,Euro Stoxx 50,eurostoxx50,#4285F4,€
        oil_20,Oil & Gas 20,oil20,#D4A017,$

#### google-cloud-kms get_crypto_key — list key versions and rotation

```python
# Show current key versions — KMS automatically manages version history
# When you rotate, the new version becomes primary for new encryptions
# Old ciphertext still decrypts because the version ID is embedded in it
key_name_full = kms_client.crypto_key_path(PROJECT_ID, KMS_LOCATION, KMS_KEYRING, KMS_KEY)

key = kms_client.get_crypto_key(name=key_name_full)
print(f"  Key:             {KMS_KEY}")
print(f"  Purpose:         {key.purpose.name}")
print(f"  Primary version: {key.primary.name.split('/')[-1]}")
print(f"  Algorithm:       {key.primary.algorithm.name}")
print(f"  Protection:      {key.primary.protection_level.name}")
print(f"  Created:         {key.primary.create_time}")
print()

# List all versions
versions = kms_client.list_crypto_key_versions(parent=key_name_full)
print("  All versions:")
for v in versions:
    ver_num = v.name.split("/")[-1]
    state = v.state.name
    print(f"    v{ver_num}: {state} (algorithm: {v.algorithm.name})")
```

      Key:             notebook-encrypt-key
      Purpose:         ENCRYPT_DECRYPT
      Primary version: 1
      Algorithm:       GOOGLE_SYMMETRIC_ENCRYPTION
      Protection:      SOFTWARE
      Created:         2026-03-25 22:10:21.518037+00:00
    
      All versions:
        v1: ENABLED (algorithm: GOOGLE_SYMMETRIC_ENCRYPTION)

#### google-cloud-storage get_bucket — verify CMEK server-side encryption

```python
# Verify the bucket uses Customer-Managed Encryption Keys (CMEK)
# CMEK means Google uses YOUR KMS key (not their default) to encrypt objects at rest
bucket_meta = gcs_client.get_bucket(BUCKET_NAME)

if bucket_meta.default_kms_key_name:
    print(f"  Bucket:           {BUCKET_NAME}")
    print(f"  Encryption:       CMEK (Customer-Managed)")
    print(f"  Default KMS key:  {bucket_meta.default_kms_key_name}")
else:
    print(f"  Bucket:           {BUCKET_NAME}")
    print(f"  Encryption:       Google-managed (default)")

print()
print("  Encryption comparison:")
print("    Google-default: Google manages the key — zero config, no control")
print("    CMEK:           You manage the key in KMS — control rotation, disable, destroy")
print("    CSEK:           You supply the key in each request — max control, max risk")
```

      Bucket:           seclab-dev-ap-26-data
      Encryption:       CMEK (Customer-Managed)
      Default KMS key:  projects/seclab-dev-ap-26/locations/europe-west1/keyRings/notebook-keyring/cryptoKeys/notebook-encrypt-key
    
      Encryption comparison:
        Google-default: Google manages the key — zero config, no control
        CMEK:           You manage the key in KMS — control rotation, disable, destroy
        CSEK:           You supply the key in each request — max control, max risk

## Compute Engine — SSH, Certificates and VM Identity

#### paramiko SSHClient — SSH to VM with Ed25519 key

```python
# Connect to the VM using the Ed25519 key generated during setup
# OS Login maps the SSH key to the Google account automatically
try:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    # Load the Ed25519 private key
    key = paramiko.Ed25519Key.from_private_key_file(SSH_KEY_PATH)

    # OS Login username format: google account email with dots/@ replaced
    os_login_user = "alexper_recovery_gmail_com"

    ssh.connect(
        hostname=VM_EXTERNAL_IP,
        username=os_login_user,
        pkey=key,
        timeout=10
    )

    # Run remote commands
    for cmd in ["hostname", "uname -a", "cat /etc/os-release | head -3"]:
        stdin, stdout, stderr = ssh.exec_command(cmd)
        output = stdout.read().decode().strip()
        print(f"  $ {cmd}")
        print(f"    {output}")
        print()

    ssh.close()
    print("  SSH connection closed")

except Exception as e:
    print(f"  SSH connection failed: {e}")
    print(f"  This is expected if the VM is stopped or firewall blocks access")
    print(f"  VM IP: {VM_EXTERNAL_IP}, Key: {SSH_KEY_PATH}")
```

      $ hostname
        notebook-vm
    
      $ uname -a
        Linux notebook-vm 6.1.0-43-cloud-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.162-1 (2026-02-08) x86_64 GNU/Linux
    
      $ cat /etc/os-release | head -3
        PRETTY_NAME="Debian GNU/Linux 12 (bookworm)"
    NAME="Debian GNU/Linux"
    VERSION_ID="12"
    
      SSH connection closed

#### gcloud compute os-login ssh-keys list — SSH key management

```python
# OS Login centralizes SSH key management — no need to edit authorized_keys on each VM
# List all SSH keys registered with OS Login for the current user
!gcloud compute os-login ssh-keys list --format="table(fingerprint, key.len())"
print()
print("  OS Login vs metadata SSH keys:")
print("    OS Login:    centralized, tied to Google identity, auto-managed")
print("    Metadata:    per-VM or project-wide, manual management, legacy")
```

    FINGERPRINT  FINGERPRINT
                 64
                 64
                 64
    
      OS Login vs metadata SSH keys:
        OS Login:    centralized, tied to Google identity, auto-managed
        Metadata:    per-VM or project-wide, manual management, legacy

#### IAP tunnel — SSH without public IP exposure

Identity-Aware Proxy (IAP) creates an encrypted tunnel to a VM without needing a public IP or VPN:

1. Your `gcloud` CLI authenticates via OAuth2
2. IAP verifies your IAM role (`roles/iap.tunnelResourceAccessor`)
3. IAP creates an encrypted tunnel to the VM's internal IP
4. SSH traffic flows through the tunnel — no public IP needed

Benefits: no public IP on the VM, no VPN required, IAM-based access control, full audit logging of tunnel sessions.

```bash
gcloud compute ssh notebook-vm --zone=europe-west1-b --tunnel-through-iap
```

      IAP TCP Tunnel command:
        gcloud compute ssh notebook-vm --zone=europe-west1-b --tunnel-through-iap
    
      How IAP works:
        1. Your gcloud CLI authenticates via OAuth2
        2. IAP verifies your IAM role (roles/iap.tunnelResourceAccessor)
        3. IAP creates an encrypted tunnel to the VM's internal IP
        4. SSH traffic flows through the tunnel — no public IP needed
    
      Benefits:
        ✓ No public IP needed on the VM
        ✓ No VPN required
        ✓ IAM-based access control (who can tunnel)
        ✓ Audit logging of all tunnel sessions

#### VM instance identity — metadata server credentials

```python
# VMs authenticate to GCP via the metadata server — no key file needed
# The metadata server provides access tokens for the VM's attached service account
print("  VM metadata server endpoints (accessible from inside the VM):")
print()
endpoints = {
    "Access token":    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
    "SA email":        "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email",
    "Instance ID":     "http://metadata.google.internal/computeMetadata/v1/instance/id",
    "Instance zone":   "http://metadata.google.internal/computeMetadata/v1/instance/zone",
    "Instance name":   "http://metadata.google.internal/computeMetadata/v1/instance/name",
    "Project ID":      "http://metadata.google.internal/computeMetadata/v1/project/project-id",
    "Identity token":  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=AUDIENCE",
}
for name, url in endpoints.items():
    print(f"  {name:20s} → {url}")

print()
print("  Usage from inside the VM:")
print('    curl -H "Metadata-Flavor: Google" \\')
print('      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token"')
```

      VM metadata server endpoints (accessible from inside the VM):
    
      Access token         → http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token
      SA email             → http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email
      Instance ID          → http://metadata.google.internal/computeMetadata/v1/instance/id
      Instance zone        → http://metadata.google.internal/computeMetadata/v1/instance/zone
      Instance name        → http://metadata.google.internal/computeMetadata/v1/instance/name
      Project ID           → http://metadata.google.internal/computeMetadata/v1/project/project-id
      Identity token       → http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=AUDIENCE
    
      Usage from inside the VM:
        curl -H "Metadata-Flavor: Google" \
          "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token"

#### google-cloud-compute FirewallsClient — audit permissive firewall rules

```python
# Audit firewall rules for security — look for 0.0.0.0/0 source ranges
compute_client = compute_v1.FirewallsClient(credentials=sa_credentials)

firewalls = compute_client.list(project=PROJECT_ID)

print(f"  Firewall rules for {PROJECT_ID}:")
print(f"  {'Name':25s} {'Direction':10s} {'Action':8s} {'Source Ranges':25s} {'Ports':20s} {'Warning':10s}")
print(f"  {'─'*25} {'─'*10} {'─'*8} {'─'*25} {'─'*20} {'─'*10}")

for fw in firewalls:
    source_ranges = ", ".join(fw.source_ranges) if fw.source_ranges else "—"
    ports = []
    for allow in fw.allowed:
        proto = allow.I_p_protocol
        port_list = ", ".join(allow.ports) if allow.ports else "all"
        ports.append(f"{proto}:{port_list}")
    ports_str = "; ".join(ports) if ports else "—"

    warning = "⚠️ OPEN" if "0.0.0.0/0" in (fw.source_ranges or []) else ""

    print(f"  {fw.name:25s} {fw.direction:10s} {'ALLOW':8s} {source_ranges:25s} {ports_str:20s} {warning}")

print()
print("  ⚠️ Rules with 0.0.0.0/0 allow traffic from ANY IP — restrict in production")
```

      Firewall rules for seclab-dev-ap-26:
      Name                      Direction  Action   Source Ranges             Ports                Warning   
      ───────────────────────── ────────── ──────── ───────────────────────── ──────────────────── ──────────
      allow-ssh                 INGRESS    ALLOW    0.0.0.0/0                 tcp:22               ⚠️ OPEN
      default-allow-icmp        INGRESS    ALLOW    0.0.0.0/0                 icmp:all             ⚠️ OPEN
      default-allow-internal    INGRESS    ALLOW    10.128.0.0/9              tcp:0-65535; udp:0-65535; icmp:all 
      default-allow-rdp         INGRESS    ALLOW    0.0.0.0/0                 tcp:3389             ⚠️ OPEN
      default-allow-ssh         INGRESS    ALLOW    0.0.0.0/0                 tcp:22               ⚠️ OPEN
    
      ⚠️ Rules with 0.0.0.0/0 allow traffic from ANY IP — restrict in production

## Cloud SQL — SQL Server Authentication and Encryption

Four Cloud SQL authentication methods, from simplest to most secure:

1. **SQL authentication (username + password)** — `pymssql.connect(server=IP, user="sqlserver", password=PW)`. For dev debugging, ad-hoc admin, legacy apps. Avoid in production/CI (credential leak risk).
2. **SSL/TLS server certificate** — download server CA cert, validate TLS chain. For public internet connections, compliance (PCI-DSS, SOC2), cross-cloud traffic. Unnecessary with Auth Proxy.
3. **Cloud SQL Auth Proxy** — run proxy binary locally, connect to `localhost:1433`. For production services (GKE/Cloud Run/GCE), CI/CD pipelines, backend APIs. The recommended default.
4. **IP allowlisting** — `gcloud sql instances patch --authorized-networks=IP/32`. For known office/VPN IPs, static CI runners, temporary debugging.

> [!abstract]- Decision matrix by scenario
>
> | Scenario | Recommended method |
> |---|---|
> | Dev running a notebook | SQL auth + IP allowlist |
> | DBA running schema migration | SQL auth + SSL + IP allowlist |
> | CI/CD pipeline deploying | Auth Proxy (sidecar container) |
> | Production API backend | Auth Proxy + Private IP |
> | End-user dashboard (via backend) | Auth Proxy (backend) → SQL auth (internal) |
> | Cross-cloud data sync | SQL auth + SSL (mandatory) |
> | Temporary debugging session | SQL auth + temporary IP allowlist |

> [!danger] Cloud SQL anti-patterns
>
> - **Hardcoding SQL passwords** in code → store in Secret Manager, read via `os.environ`
> - **`0.0.0.0/0` as authorized network** → restrict to specific IPs or use Auth Proxy
> - **Public IP without SSL** in production → credentials travel in plaintext
> - **Shared admin account** across services → create per-service SQL logins with least-privilege
> - **Stale IP allowlist entries** after debugging → remove when done

#### SQL Server password authentication — direct connect

#### Authorize current IP in Cloud SQL

Cloud SQL only accepts connections from authorized IPs. This cell detects your public IP and patches the allowlist automatically. Re-running is safe (replaces the full list). Takes 5–10 minutes.

```python
my_ip = http_requests.get("https://api.ipify.org").text.strip()
print(f"  Your public IP: {my_ip}")

subprocess.run(
    f"gcloud sql instances patch {SQL_INSTANCE} --project={PROJECT_ID} --authorized-networks={my_ip}/32 --quiet",
    shell=True
)
```

      Your public IP: 86.49.254.2

    CompletedProcess(args='gcloud sql instances patch notebook-sql --project=seclab-dev-ap-26 --authorized-networks=86.49.254.2/32 --quiet', returncode=0)

```python
# check if IP was successfully authorized
!gcloud sql instances describe notebook-sql --project=seclab-dev-ap-26 --format="value(settings.ipConfiguration.authorizedNetworks)"
```

    {'kind': 'sql#aclEntry', 'name': '', 'value': '86.49.254.2/32'}

```python
# Connect to Cloud SQL for SQL Server using traditional password authentication
# The instance has a public IP and accepts connections on port 1433

try:
    conn = pymssql.connect(
        server=SQL_IP,
        user="sqlserver",
        password=SQL_PASSWORD,
        port="1433",
        login_timeout=10
    )
    cursor = conn.cursor()

    # Verify connection
    cursor.execute("SELECT @@VERSION")
    row = cursor.fetchone()
    version = str(row[0]) if row else "unknown"
    print(f"  Connected to Cloud SQL")
    print(f"  Version: {version[:80]}...")

    cursor.execute("SELECT GETDATE() AS now")
    row = cursor.fetchone()
    now = row[0] if row else "unknown"
    print(f"  Server time: {now}")

    cursor.close()
    conn.close()
    print("  Connection closed")

except Exception as e:
    print(f"  Connection failed: {e}")
    print(f"  This is expected if your IP is not in the authorized networks")
    print(f"  Add your IP: gcloud sql instances patch {SQL_INSTANCE} --authorized-networks=YOUR_IP/32")
```

      Connected to Cloud SQL
      Version: Microsoft SQL Server 2022 (RTM-CU23) (KB5078297) - 16.0.4236.2 (X64) 
    	Jan 22 20...
      Server time: 2026-03-26 03:44:50.037000
      Connection closed

#### Cloud SQL SSL server CA certificate — download and inspect

```python
# Cloud SQL generates a server CA certificate that validates the instance identity
# Download it and inspect the certificate details

try:
    result = subprocess.run(
        ["gcloud", "sql", "instances", "describe", SQL_INSTANCE,
         "--format=value(serverCaCert.cert)"],
        capture_output=True, text=True, shell=True, timeout=30
    )

    if result.returncode == 0 and result.stdout.strip():
        server_ca_pem = result.stdout.strip()
        print("  Server CA Certificate:")
        print(f"    Length: {len(server_ca_pem)} bytes")

        # Parse certificate with cryptography
        from cryptography import x509
        from cryptography.hazmat.backends import default_backend

        cert = x509.load_pem_x509_certificate(
            server_ca_pem.encode(), default_backend()
        )
        print(f"    Subject:    {cert.subject}")
        print(f"    Issuer:     {cert.issuer}")
        print(f"    Not before: {cert.not_valid_before_utc}")
        print(f"    Not after:  {cert.not_valid_after_utc}")
        print(f"    Serial:     {cert.serial_number}")
        print(f"    Algorithm:  {cert.signature_algorithm_oid._name}")

        # Save for later use
        Path("server-ca.pem").write_text(server_ca_pem)
        print("    Saved to: server-ca.pem")
    else:
        print(f"  Could not retrieve CA cert: {result.stderr[:200]}")

except Exception as e:
    print(f"  Certificate retrieval failed: {e}")
```

      Server CA Certificate:
        Length: 1252 bytes
        Subject:    <Name(2.5.4.46=69d575e2-2aa2-4788-b14d-533fdb67a94d,CN=Cloud SQL Server CA,O=Google\, Inc,C=US)>
        Issuer:     <Name(2.5.4.46=69d575e2-2aa2-4788-b14d-533fdb67a94d,CN=Cloud SQL Server CA,O=Google\, Inc,C=US)>
        Not before: 2026-03-26 03:18:11+00:00
        Not after:  2036-03-23 03:19:11+00:00
        Serial:     0
        Algorithm:  sha256WithRSAEncryption
        Saved to: server-ca.pem

    C:\Users\aperi\AppData\Local\Temp\ipykernel_28040\2555882462.py:20: CryptographyDeprecationWarning: Parsed a serial number which wasn't positive (i.e., it was negative or zero), which is disallowed by RFC 5280. Loading this certificate will cause an exception in a future release of cryptography.
      cert = x509.load_pem_x509_certificate(
    C:\Users\aperi\AppData\Local\Temp\ipykernel_28040\2555882462.py:27: CryptographyDeprecationWarning: Parsed a serial number which wasn't positive (i.e., it was negative or zero), which is disallowed by RFC 5280. Loading this certificate will cause an exception in a future release of cryptography.
      print(f"    Serial:     {cert.serial_number}")

#### pymssql — SSL-verified connection to Cloud SQL

The server CA certificate proves you're talking to the real Cloud SQL instance (MITM protection). This does NOT replace username/password — the cert verifies the server, the password verifies the client. Required for public internet, compliance (PCI-DSS, SOC2), cross-cloud traffic.

> [!danger] Never use TrustServerCertificate=yes in production
>
> Never use `TrustServerCertificate=yes` in production — accepts any cert. Don't assume encryption = authentication (encrypted channel to the wrong server is still compromised).

pymssql uses FreeTDS — TLS via `TDSSSL` env var, cert validation via `TDSCAFILE`.

```python
try:
    # Tell FreeTDS to require encryption and verify the server cert
    os.environ["TDSSSL"] = "require"
    os.environ["TDSCAFILE"] = str(Path("server-ca.pem").resolve())

    conn = pymssql.connect(
        server=SQL_IP,
        user="sqlserver",
        password=SQL_PASSWORD,
        port="1433",
        login_timeout=10,
        tds_version="7.3"
    )
    cursor = conn.cursor()
    cursor.execute("SELECT @@VERSION")
    row = cursor.fetchone()
    print(f"  SSL-verified connection: OK")
    print(f"  CA file: {os.environ['TDSCAFILE']}")
    print(f"  Server: {str(row[0])[:60] if row else 'unknown'}...")
    cursor.close()
    conn.close()
except Exception as e:
    print(f"  SSL connection: {e}")
finally:
    # Clean up so subsequent connections are not affected
    os.environ.pop("TDSSSL", None)
    os.environ.pop("TDSCAFILE", None)
```

      SSL-verified connection: OK
      CA file: C:\Users\aperi\DEV\LANG\server-ca.pem
      Server: Microsoft SQL Server 2022 (RTM-CU23) (KB5078297) - 16.0.4236...

#### Cloud SQL Auth Proxy — IAM-authenticated tunnel

The Auth Proxy creates a local encrypted tunnel to Cloud SQL. It authenticates via IAM — no password or SSL certificate needed by the client.

```bash
# 1. Download the proxy
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.14.3/cloud-sql-proxy.win64.exe

# 2. Start the proxy
./cloud-sql-proxy seclab-dev-ap-26:europe-west1:notebook-sql --port=1433

# 3. Connect via localhost (no public IP needed)
# pymssql.connect(server='127.0.0.1', port=1433, ...)
```

| Method | Public IP | SSL | IAM Auth | Key File |
|---|---|---|---|---|
| Direct + password | Required | Optional | No | No |
| Direct + SSL certs | Required | Yes | No | Client cert |
| Auth Proxy | No | Auto | Yes | No |
| Private IP | No | Optional | Optional | No |

#### Cloud SQL authorized networks — IP whitelisting

```python
# List authorized networks (IP addresses allowed to connect)
# Only IPs in this list can reach the public IP of the SQL instance
!gcloud sql instances describe {SQL_INSTANCE} --format="yaml(settings.ipConfiguration)"
print()
print("  To add your current IP:")
print(f"    gcloud sql instances patch {SQL_INSTANCE} --authorized-networks=YOUR_IP/32")
print()
print("  ⚠️ Never use 0.0.0.0/0 — it allows connections from any IP on the internet")
```

    settings:
      ipConfiguration:
        authorizedNetworks:
        - kind: sql#aclEntry
          name: ''
          value: 86.49.254.2/32
        ipv4Enabled: true
        requireSsl: false
        serverCaMode: GOOGLE_MANAGED_INTERNAL_CA
        serverCertificateRotationMode: SERVER_CERTIFICATE_ROTATION_MODE_UNSPECIFIED
        sslMode: ALLOW_UNENCRYPTED_AND_ENCRYPTED
    
      To add your current IP:
        gcloud sql instances patch notebook-sql --authorized-networks=YOUR_IP/32
    
      ⚠️ Never use 0.0.0.0/0 — it allows connections from any IP on the internet

#### Cloud SQL encryption at rest — check instance encryption

Check if the instance uses CMEK or Google-default encryption for data at rest. Empty output = Google-default. CMEK requires `--disk-encryption-key` at creation time — cannot be changed after.

```python
!gcloud sql instances describe {SQL_INSTANCE} --format="yaml(diskEncryptionConfiguration, diskEncryptionStatus)"
print()
print("  (empty = Google-default encryption, not CMEK)")
```

    diskEncryptionConfiguration:
      kind: sql#diskEncryptionConfiguration
      kmsKeyName: projects/seclab-dev-ap-26/locations/europe-west1/keyRings/notebook-keyring/cryptoKeys/notebook-encrypt-key
    diskEncryptionStatus:
      kind: sql#diskEncryptionStatus
      kmsKeyVersionName: projects/seclab-dev-ap-26/locations/europe-west1/keyRings/notebook-keyring/cryptoKeys/notebook-encrypt-key/cryptoKeyVersions/1
    
      (empty = Google-default encryption, not CMEK)

## BigQuery — Secure Data Operations

#### google-cloud-bigquery Client — query with service account credentials

```python
# Authenticate to BigQuery using the SA key and run a query
bq_client = bigquery.Client(project=PROJECT_ID, credentials=sa_credentials)

query = f"""
    SELECT symbol, ROUND(close, 2) AS close,
           ROUND(momentum_score * 100, 2) AS momentum_pct,
           composite_rank
    FROM `{PROJECT_ID}.{BQ_DATASET}.gold_scores`
    ORDER BY composite_rank
    LIMIT 10
"""

results = bq_client.query(query).to_dataframe()
print(f"  Top 10 stocks by composite rank (SA key auth):")
print(results.to_string(index=False))
```

      Top 10 stocks by composite rank (SA key auth):
     symbol   close  momentum_pct  composite_rank
     ENI.MI   21.34         12.74               1
     DB1.DE  237.90          6.98               2
     TTE.PA   69.77          6.47               3
      AD.AS   41.05          5.54               4
     PRX.AS   45.69          3.28               5
     DTE.DE   32.55          1.81               6
     WKL.AS   67.32          1.17               7
      AI.PA  168.02         -0.96               8
      SU.PA  254.65         -1.03               9
    ASML.AS 1190.80         -1.13              10

#### google-cloud-bigquery Client — query with impersonated credentials

```python
# Same query but using impersonated credentials — no key file on the target system
impersonated_bq = bigquery.Client(
    project=PROJECT_ID,
    credentials=impersonated_creds
)

results = impersonated_bq.query(f"""
    SELECT COUNT(*) as total_rows,
           MIN(composite_rank) as best_rank,
           MAX(composite_rank) as worst_rank
    FROM `{PROJECT_ID}.{BQ_DATASET}.gold_scores`
""").to_dataframe()

print(f"  BigQuery query via impersonation:")
print(results.to_string(index=False))
```

      BigQuery query via impersonation:
     total_rows  best_rank  worst_rank
             50          1          50

#### google-cloud-kms + BigQuery — column-level encryption before insert

Encrypt individual field values with KMS before inserting into BigQuery — the table stores ciphertext. Only callers with KMS decrypt access see plaintext. Use for PII (GDPR, CCPA), multi-tenant isolation, or shared datasets with sensitive columns.

> [!warning] Don’t encrypt columns you need
>
> Don’t encrypt columns you need to query/filter/join on — ciphertext is not searchable (use tokenization instead). Don’t use the same KMS key for all tenants.

```python
sample_data = [
    {"symbol": "AAPL", "portfolio_id": "PF-001", "allocation_pct": 15.5},
    {"symbol": "MSFT", "portfolio_id": "PF-002", "allocation_pct": 22.0},
    {"symbol": "GOOG", "portfolio_id": "PF-003", "allocation_pct": 18.3},
]

# Encrypt portfolio_id with KMS
encrypted_rows = []
for row in sample_data:
    enc_response = kms_client.encrypt(
        name=key_name,
        plaintext=row["portfolio_id"].encode()
    )
    encrypted_rows.append({
        "symbol": row["symbol"],
        "portfolio_id_encrypted": base64.b64encode(enc_response.ciphertext).decode(),
        "allocation_pct": row["allocation_pct"],
    })

# Create table and insert
table_id = f"{PROJECT_ID}.{BQ_DATASET}.encrypted_demo"
schema = [
    bigquery.SchemaField("symbol", "STRING"),
    bigquery.SchemaField("portfolio_id_encrypted", "STRING"),
    bigquery.SchemaField("allocation_pct", "FLOAT64"),
]

table = bigquery.Table(table_id, schema=schema)
try:
    bq_client.delete_table(table_id, not_found_ok=True)
    bq_client.create_table(table)
    bq_client.insert_rows_json(table_id, encrypted_rows)
    print(f"  Inserted {len(encrypted_rows)} rows with encrypted portfolio_id")
except Exception as e:
    print(f"  Insert: {e}")
```

      Inserted 3 rows with encrypted portfolio_id

#### Query encrypted data — ciphertext in results

```python
# Query the table — portfolio_id is ciphertext (unreadable without KMS key)
results = bq_client.query(f"""
    SELECT symbol, portfolio_id_encrypted, allocation_pct
    FROM `{table_id}`
""").to_dataframe()

print("  Encrypted data in BigQuery:")
for _, row in results.iterrows():
    enc_preview = row["portfolio_id_encrypted"][:40] + "..."
    print(f"    {row['symbol']:6s}  {enc_preview}  {row['allocation_pct']:5.1f}%")
```

      Encrypted data in BigQuery:
        AAPL    CiQAvMIMGyYPhMQKedON8veCpJC21PuG2RsOFM4K...   15.5%
        MSFT    CiQAvMIMG67CLZrcvMqcbL1RaHNbTo3yXGn1N9vv...   22.0%
        GOOG    CiQAvMIMG0AZnsgg5gCtjfifR/XHBZcVmVG4uxsK...   18.3%

#### google-cloud-kms decrypt — decrypt BigQuery column values after query

```python
# Decrypt the portfolio_id values using KMS after fetching from BigQuery
print("  Decrypted data:")
for _, row in results.iterrows():
    ciphertext = base64.b64decode(row["portfolio_id_encrypted"])
    dec_response = kms_client.decrypt(name=key_name, ciphertext=ciphertext)
    portfolio_id = dec_response.plaintext.decode()
    print(f"    {row['symbol']:6s}  {portfolio_id}  {row['allocation_pct']:5.1f}%")

# Cleanup
bq_client.delete_table(table_id, not_found_ok=True)
print(f"  Cleaned up: {table_id}")
```

      Decrypted data:
        AAPL    PF-001   15.5%
        MSFT    PF-002   22.0%
        GOOG    PF-003   18.3%
      Cleaned up: seclab-dev-ap-26.index_data.encrypted_demo

#### google-cloud-bigquery get_dataset — verify default encryption

```python
# Check encryption settings on the BigQuery dataset and tables
dataset = bq_client.get_dataset(f"{PROJECT_ID}.{BQ_DATASET}")

print(f"  Dataset: {BQ_DATASET}")
print(f"  Default encryption: {dataset.default_encryption_configuration or 'Google-managed'}")
print()

# Check table-level encryption
tables = list(bq_client.list_tables(f"{PROJECT_ID}.{BQ_DATASET}"))
print(f"  Tables ({len(tables)}):")
for t in tables:
    full_table = bq_client.get_table(t)
    enc = full_table.encryption_configuration
    enc_str = f"CMEK: {enc.kms_key_name}" if enc else "Google-managed"
    print(f"    {t.table_id:25s}  {full_table.num_rows:>8,d} rows  {enc_str}")
```

      Dataset: index_data
      Default encryption: Google-managed
    
      Tables (3):
        bronze_ohlcv                 66,355 rows  Google-managed
        gold_scores                      50 rows  Google-managed
        silver_ohlcv                 66,355 rows  Google-managed

#### Authorized view — expose only non-sensitive columns

```python
# Create a view that exposes only safe columns from gold_scores
# Grant access to the view without granting access to the base table
view_id = f"{PROJECT_ID}.{BQ_DATASET}.gold_scores_public"

view_sql = f"""
    SELECT symbol, composite_rank,
           ROUND(momentum_score * 100, 2) AS momentum_pct
    FROM `{PROJECT_ID}.{BQ_DATASET}.gold_scores`
"""

view = bigquery.Table(view_id)
view.view_query = view_sql

try:
    bq_client.delete_table(view_id, not_found_ok=True)
    created_view = bq_client.create_table(view)
    print(f"  Created authorized view: {view_id}")

    # Query through the view
    results = bq_client.query(f"SELECT * FROM `{view_id}` ORDER BY composite_rank LIMIT 5").to_dataframe()
    print(f"  View results (sensitive columns hidden):")
    print(results.to_string(index=False))
except Exception as e:
    print(f"  View creation: {e}")
```

      Created authorized view: seclab-dev-ap-26.index_data.gold_scores_public
      View results (sensitive columns hidden):
    symbol  composite_rank  momentum_pct
    ENI.MI               1         12.74
    DB1.DE               2          6.98
    TTE.PA               3          6.47
     AD.AS               4          5.54
    PRX.AS               5          3.28

## Firestore — Secure Document Operations

#### google-cloud-firestore Client — read documents with SA credentials

```python
# Connect to the named Firestore database and read existing score documents
fs_client = firestore.Client(
    project=PROJECT_ID,
    database=FIRESTORE_DB,
    credentials=sa_credentials
)

# Read top 5 scores
docs = fs_client.collection("scores_latest").order_by("composite_rank").limit(5).stream()

print(f"  Top 5 scores from Firestore ({FIRESTORE_DB}):")
print(f"  {'Symbol':12s} {'Close':>10s} {'Rank':>6s} {'Momentum':>10s}")
print(f"  {'─'*12} {'─'*10} {'─'*6} {'─'*10}")

for doc in docs:
    d = doc.to_dict()
    momentum = d.get("momentum_score", 0)
    if momentum is not None:
        print(f"  {d['symbol']:12s} {d['close']:>10.2f} {d['composite_rank']:>6d} {momentum:>+10.4f}")
```

      Top 5 scores from Firestore (seclab-scores):
      Symbol            Close   Rank   Momentum
      ──────────── ────────── ────── ──────────
      ENI.MI            21.34      1    +0.1274
      DB1.DE           237.90      2    +0.0698
      TTE.PA            69.77      3    +0.0647
      AD.AS             41.05      4    +0.0554
      PRX.AS            45.69      5    +0.0328

#### google-cloud-firestore document.set — write a new document

```python
# Create a new document in Firestore — demonstrates write access
doc_ref = fs_client.collection("scores_latest").document("DEMO_STOCK")

doc_ref.set({
    "symbol": "DEMO_STOCK",
    "close": 100.00,
    "daily_return": 0.015,
    "momentum_score": 0.042,
    "volume_score": 1.25,
    "composite_rank": 99,
    "updated_at": firestore.SERVER_TIMESTAMP,
    "created_by": "notebook-21",
})

print(f"  Written: DEMO_STOCK to scores_latest")

# Read it back
doc = fs_client.collection("scores_latest").document("DEMO_STOCK").get()
print(f"  Verified: {doc.to_dict()['symbol']} rank={doc.to_dict()['composite_rank']}")
```

      Written: DEMO_STOCK to scores_latest
      Verified: DEMO_STOCK rank=99

#### google-cloud-firestore document.update — partial merge

```python
# Update specific fields without overwriting the entire document
doc_ref = fs_client.collection("scores_latest").document("DEMO_STOCK")

doc_ref.update({
    "close": 105.50,
    "daily_return": 0.055,
    "updated_at": firestore.SERVER_TIMESTAMP,
})

updated = doc_ref.get().to_dict()
print(f"  Updated DEMO_STOCK:")
print(f"    close:        {updated['close']}")
print(f"    daily_return: {updated['daily_return']}")
print(f"    created_by:   {updated['created_by']}  ← preserved from original")
```

      Updated DEMO_STOCK:
        close:        105.5
        daily_return: 0.055
        created_by:   notebook-21  ← preserved from original

#### google-cloud-kms + Firestore — field-level encryption before write

```python
# Encrypt specific fields with KMS before writing to Firestore
# This protects sensitive data even from Firestore admins
sensitive_data = {
    "symbol": "AAPL",
    "portfolio_id": "PF-SECRET-001",
    "position_size": 50000.00,
    "risk_notes": "High concentration risk — review quarterly",
}

# Encrypt sensitive fields
enc_portfolio = kms_client.encrypt(
    name=key_name,
    plaintext=sensitive_data["portfolio_id"].encode()
).ciphertext
enc_notes = kms_client.encrypt(
    name=key_name,
    plaintext=sensitive_data["risk_notes"].encode()
).ciphertext

# Write with encrypted fields
doc_ref = fs_client.collection("encrypted_positions").document("AAPL")
doc_ref.set({
    "symbol": sensitive_data["symbol"],
    "portfolio_id_enc": base64.b64encode(enc_portfolio).decode(),
    "position_size": sensitive_data["position_size"],
    "risk_notes_enc": base64.b64encode(enc_notes).decode(),
    "encryption_key": f"{KMS_KEYRING}/{KMS_KEY}",
    "created_at": firestore.SERVER_TIMESTAMP,
})

print(f"  Written encrypted document: encrypted_positions/AAPL")
print(f"    portfolio_id: encrypted ({len(enc_portfolio)} bytes)")
print(f"    risk_notes:   encrypted ({len(enc_notes)} bytes)")
print(f"    symbol:       plaintext (non-sensitive)")
```

      Written encrypted document: encrypted_positions/AAPL
        portfolio_id: encrypted (94 bytes)
        risk_notes:   encrypted (125 bytes)
        symbol:       plaintext (non-sensitive)

#### google-cloud-firestore + google-cloud-kms — read and decrypt fields

```python
# Read the encrypted document and decrypt the sensitive fields with KMS
doc = fs_client.collection("encrypted_positions").document("AAPL").get()
data = doc.to_dict()

# Decrypt fields
dec_portfolio = kms_client.decrypt(
    name=key_name,
    ciphertext=base64.b64decode(data["portfolio_id_enc"])
).plaintext.decode()

dec_notes = kms_client.decrypt(
    name=key_name,
    ciphertext=base64.b64decode(data["risk_notes_enc"])
).plaintext.decode()

print(f"  Decrypted document: encrypted_positions/AAPL")
print(f"    symbol:       {data['symbol']}")
print(f"    portfolio_id: {dec_portfolio}")
print(f"    position:     {data['position_size']:,.2f}")
print(f"    risk_notes:   {dec_notes}")
```

      Decrypted document: encrypted_positions/AAPL
        symbol:       AAPL
        portfolio_id: PF-SECRET-001
        position:     50,000.00
        risk_notes:   High concentration risk — review quarterly

#### Firestore access control — IAM vs security rules

Firestore has **two** access control layers:

1. **IAM roles (Google Cloud)** — apply to server-side SDKs and REST API. `roles/datastore.user` (read/write), `roles/datastore.viewer` (read-only), `roles/datastore.owner` (full control + index management). This is what controls access from Python/server environments.

2. **Security rules (Firebase)** — apply ONLY to Firebase client SDKs (web, mobile). Written in a declarative language, deployed via Firebase CLI. Server-side admin SDKs bypass rules completely.

> [!info] This section demonstrates IAM-based access
>
> This section demonstrates IAM-based access control, which is what governs access from server-side code. The `googleapis.com` REST API uses IAM, not Firebase security rules.

#### Full-access write with SA credentials

```python
# The notebook SA has roles/datastore.owner, so it can read/write any document.
# This is the standard server-side pattern: authenticate with a SA that has
# the appropriate IAM role, and the admin SDK has full access.
fs_client = firestore.Client(project=PROJECT_ID, database=FIRESTORE_DB, credentials=sa_credentials)
fs_client.collection("access_test").document("iam_demo").set({
    "message": "written by notebook-sa",
    "timestamp": datetime.datetime.now().isoformat()
})
doc = fs_client.collection("access_test").document("iam_demo").get()  # type: ignore[union-attr]
print(f"  Write + read with SA: OK")
print(f"  Data: {doc.to_dict()}")  # type: ignore[union-attr]
```

      Write + read with SA: OK
      Data: {'message': 'written by notebook-sa', 'timestamp': '2026-03-26T05:08:41.095980'}

#### Scoped credentials — read-only access attempt

```python
# Demonstrate that scoping credentials restricts what the SA can do.
# With only the devstorage read scope, Firestore operations should fail
# because the token lacks the required Firestore/Datastore scope.
read_only_creds = sa_credentials.with_scopes([
    "https://www.googleapis.com/auth/devstorage.read_only"
])
try:
    limited_client = firestore.Client(
        project=PROJECT_ID, database=FIRESTORE_DB, credentials=read_only_creds
    )
    limited_client.collection("access_test").document("iam_demo").get()
    print("  Read with storage-only scope: OK (unexpected)")
except Exception as e:
    print(f"  Read with storage-only scope: DENIED")
    print(f"  Error: {str(e)[:100]}")
    print("  \u2192 Scope restriction works: token lacks Firestore permission")
```

      Read with storage-only scope: DENIED
      Error: 403 Request had insufficient authentication scopes. [reason: "ACCESS_TOKEN_SCOPE_INSUFFICIENT"
    domai
      → Scope restriction works: token lacks Firestore permission

#### Test IAM permission check on Firestore

```python
# Use testIamPermissions to see exactly what the SA can do on the database.
# This is the IAM equivalent of checking security rules.
r = subprocess.run(
    ["gcloud", "firestore", "databases", "describe",
     f"--database={FIRESTORE_DB}", f"--project={PROJECT_ID}",
     "--format=value(name,type)"],
    capture_output=True, text=True, shell=True
)
print(f"  Database: {r.stdout.strip()}")

# Check SA roles
r2 = subprocess.run(
    f"gcloud projects get-iam-policy {PROJECT_ID} --flatten=bindings[].members "
    f"--filter=bindings.members:{SA_EMAIL} --format=table(bindings.role)",
    capture_output=True, text=True, shell=True
)
print(f"  SA roles relevant to Firestore:")
for line in r2.stdout.strip().splitlines():
    if "datastore" in line.lower() or "firestore" in line.lower() or "ROLE" in line:
        print(f"    {line.strip()}")
```

      Database: projects/seclab-dev-ap-26/databases/seclab-scores	FIRESTORE_NATIVE
      SA roles relevant to Firestore:
        ROLE
        roles/datastore.owner

#### Cleanup access test document

```python
# Remove the test document created for the IAM demonstration.
fs_client.collection("access_test").document("iam_demo").delete()
print("  Cleaned up iam_demo document")
```

      Cleaned up iam_demo document

#### Delete demo documents — cleanup

```python
# Clean up demo documents to keep Firestore tidy
for collection, doc_id in [("scores_latest", "DEMO_STOCK"), ("encrypted_positions", "AAPL")]:
    try:
        fs_client.collection(collection).document(doc_id).delete()
        print(f"  Deleted: {collection}/{doc_id}")
    except Exception as e:
        print(f"  Cleanup {collection}/{doc_id}: {e}")
```

      Deleted: scores_latest/DEMO_STOCK
      Deleted: encrypted_positions/AAPL

## Cloud Storage — Encryption and Access Control

#### Upload to CMEK-encrypted bucket — verify server-side encryption

```python
# Upload a file to the CMEK-encrypted bucket and verify the KMS key is applied
gcs_client = storage.Client(project=PROJECT_ID, credentials=sa_credentials)
bucket = gcs_client.bucket(BUCKET_NAME)

# Upload a test file
test_content = "symbol,close,rank\nAAPL,185.50,1\nMSFT,420.00,2\n"
blob = bucket.blob("security-demo/test_upload.csv")
blob.upload_from_string(test_content, content_type="text/csv")

# Reload to get metadata including KMS key
blob.reload()
print(f"  Uploaded:          security-demo/test_upload.csv")
print(f"  Size:              {blob.size} bytes")
print(f"  KMS key:           {blob.kms_key_name or 'Google-managed'}")
print(f"  Content type:      {blob.content_type}")
print(f"  Storage class:     {blob.storage_class}")
print(f"  CRC32C:            {blob.crc32c}")
print(f"  MD5:               {blob.md5_hash}")
```

      Uploaded:          security-demo/test_upload.csv
      Size:              46 bytes
      KMS key:           projects/seclab-dev-ap-26/locations/europe-west1/keyRings/notebook-keyring/cryptoKeys/notebook-encrypt-key/cryptoKeyVersions/1
      Content type:      text/csv
      Storage class:     STANDARD
      CRC32C:            Z58l3A==
      MD5:               DZTKSZ2pzrW0OKa+1XDM9A==

#### cryptography AESGCM — client-side encryption before GCS upload

```python
# Encrypt a file locally before uploading — independent of server-side encryption
# Double encryption: your key (client-side) + Google's CMEK (server-side)

# Generate a local encryption key
local_key = AESGCM.generate_key(bit_length=256)
nonce = os.urandom(12)
aesgcm = AESGCM(local_key)

# Encrypt data
plaintext_data = b"Confidential: Q4 portfolio allocations and risk metrics"
encrypted_data = aesgcm.encrypt(nonce, plaintext_data, None)

# Wrap the local key with KMS for safe storage
wrapped_key = kms_client.encrypt(name=key_name, plaintext=local_key).ciphertext

# Upload encrypted data and the wrapped key
blob_enc = bucket.blob("security-demo/confidential.enc")
blob_enc.upload_from_string(encrypted_data)

blob_key = bucket.blob("security-demo/confidential.key")
blob_key.metadata = {"nonce": base64.b64encode(nonce).decode()}
blob_key.upload_from_string(wrapped_key)

print(f"  Encrypted file:    confidential.enc ({len(encrypted_data)} bytes)")
print(f"  Wrapped key:       confidential.key ({len(wrapped_key)} bytes)")
print(f"  Nonce:             {base64.b64encode(nonce).decode()}")
print(f"  Encryption:        AES-256-GCM (client) + CMEK (server)")
```

      Encrypted file:    confidential.enc (71 bytes)
      Wrapped key:       confidential.key (113 bytes)
      Nonce:             46KNSAuwqqS34IEe
      Encryption:        AES-256-GCM (client) + CMEK (server)

#### cryptography AESGCM — download and decrypt client-side encrypted file

```python
# Download the encrypted file and its wrapped key, then decrypt
enc_data = bucket.blob("security-demo/confidential.enc").download_as_bytes()

key_blob = bucket.blob("security-demo/confidential.key")
key_blob.reload()
stored_nonce = base64.b64decode(key_blob.metadata["nonce"])
wrapped = key_blob.download_as_bytes()

# Unwrap the key with KMS
recovered_key = kms_client.decrypt(name=key_name, ciphertext=wrapped).plaintext

# Decrypt the data
aesgcm = AESGCM(recovered_key)
recovered_data = aesgcm.decrypt(stored_nonce, enc_data, None)

print(f"  Decrypted: {recovered_data.decode()}")
print(f"  Match:     {recovered_data == plaintext_data}")
```

      Decrypted: Confidential: Q4 portfolio allocations and risk metrics
      Match:     True

#### Customer-Supplied Encryption Keys (CSEK)

CSEK: you provide a 256-bit AES key in the request header. Google uses it but **never stores it** — lost key = permanent data loss. Maximum customer control. Use for ultra-sensitive data where even trusting Google with a KMS key is not acceptable.

> [!danger] Never store the CSEK key
>
> Never store the CSEK key in GCS or any Google service. Never use the same key for all objects. Always have a key backup strategy. Prefer CMEK when it satisfies compliance — CSEK adds significant operational burden.

```python
csek_key = os.urandom(32)
csek_key_b64 = base64.b64encode(csek_key).decode()
csek_key_hash = base64.b64encode(hashlib.sha256(csek_key).digest()).decode()

print(f"  CSEK key (b64):  {csek_key_b64[:30]}...")
print(f"  CSEK SHA-256:    {csek_key_hash[:30]}...")

# Upload with CSEK
blob_csek = bucket.blob("security-demo/csek_test.txt", encryption_key=csek_key)
blob_csek.upload_from_string(
    "This data is encrypted with a customer-supplied key"
)
print(f"  Uploaded with CSEK: csek_test.txt")

# Download with same CSEK key
blob_csek_dl = bucket.blob("security-demo/csek_test.txt", encryption_key=csek_key)
content = blob_csek_dl.download_as_string()
print(f"  Downloaded with CSEK: {content.decode()}")

print()
print("  ⚠️ CSEK risk: if you lose this key, the data is IRRECOVERABLE")
print("  Google does not store CSEK keys — you must manage them yourself")
```

      CSEK key (b64):  ItHJaEjT0j6tLEZtba2d0W8BOeAZje...
      CSEK SHA-256:    JTuNxC8pBjyQt+5peLu4OxjwYLzwNC...
      Uploaded with CSEK: csek_test.txt
      Downloaded with CSEK: This data is encrypted with a customer-supplied key
    
      ⚠️ CSEK risk: if you lose this key, the data is IRRECOVERABLE
      Google does not store CSEK keys — you must manage them yourself

#### google-cloud-storage generate_signed_url — time-limited access

Signed URLs grant time-limited access to a private GCS object without requiring authentication. Use for sharing with external users, frontend direct upload/download, temporary links in emails. Max 7 days; cannot be revoked before expiry.

> [!warning] Don't log signed URLs (anyone
>
> Don't log signed URLs (anyone reading logs gets access). Use the shortest expiration needed. Don't use the same SA for signing and production (key rotation invalidates all URLs).

```python
blob_to_sign = bucket.blob("bronze/csv/dim_index.csv")

# Generate a V4 signed URL valid for 15 minutes
signed_url = blob_to_sign.generate_signed_url(
    version="v4",
    expiration=timedelta(minutes=15),
    method="GET",
    credentials=sa_credentials,
)

print(f"  Signed URL for bronze/csv/dim_index.csv:")
print(f"    {signed_url[:100]}...")
print(f"    Expires in: 15 minutes")
print()

# Access the signed URL with no authentication
response = http_requests.get(signed_url)
print(f"  GET response: {response.status_code}")
print(f"  Content size: {len(response.content)} bytes")
print(f"  First line:   {response.text.split(chr(10))[0]}")
```

      Signed URL for bronze/csv/dim_index.csv:
        https://storage.googleapis.com/seclab-dev-ap-26-data/bronze/csv/dim_index.csv?X-Goog-Algorithm=GOOG4...
        Expires in: 15 minutes
    
      GET response: 200
      Content size: 247 bytes
      First line:   index_key,display_name,file_prefix,color,currency

#### google-cloud-storage generate_signed_url — presigned PUT upload

```python
# Generate a signed URL for uploading — allows unauthenticated PUT
upload_blob = bucket.blob("security-demo/signed_upload_test.txt")

signed_upload_url = upload_blob.generate_signed_url(
    version="v4",
    expiration=timedelta(minutes=15),
    method="PUT",
    content_type="text/plain",
    credentials=sa_credentials,
)

# Upload using the signed URL
response = http_requests.put(
    signed_upload_url,
    data="Uploaded via signed URL — no credentials needed",
    headers={"Content-Type": "text/plain"}
)

print(f"  Signed upload URL generated (expires in 15 min)")
print(f"  PUT response:  {response.status_code}")

# Verify the upload
uploaded_blob = bucket.blob("security-demo/signed_upload_test.txt")
content = uploaded_blob.download_as_string()
print(f"  Verified:      {content.decode()}")
```

      Signed upload URL generated (expires in 15 min)
      PUT response:  200
      Verified:      Uploaded via signed URL — no credentials needed

#### google-cloud-storage get_iam_policy — bucket access control audit

```python
# Check who has access to the bucket — IAM is the preferred access control method
bucket_iam = bucket.get_iam_policy(requested_policy_version=3)

print(f"  IAM policy for gs://{BUCKET_NAME}:")
print(f"  Version: {bucket_iam.version}")
print()
for binding in bucket_iam.bindings:
    print(f"  Role: {binding['role']}")
    for member in binding['members']:
        print(f"    → {member}")
    print()

print("  Access control modes:")
print("    Uniform (IAM only): recommended — single permission model")
print("    Fine-grained (ACL): legacy — per-object ACLs, harder to audit")
```

      IAM policy for gs://seclab-dev-ap-26-data:
      Version: 1
    
      Role: roles/storage.legacyBucketOwner
        → projectEditor:seclab-dev-ap-26
        → projectOwner:seclab-dev-ap-26
    
      Role: roles/storage.legacyBucketReader
        → projectViewer:seclab-dev-ap-26
    
      Access control modes:
        Uniform (IAM only): recommended — single permission model
        Fine-grained (ACL): legacy — per-object ACLs, harder to audit

## Cross-Service Security Patterns

#### End-to-end encrypted pipeline — Secret Manager → SQL → KMS → Firestore → GCS → BigQuery

#### End-to-end encrypted pipeline — overview

Complete secure data flow: `Secret Manager → BigQuery → Cloud KMS → Firestore → GCS`. Every step: SA authentication, TLS in transit, KMS + CMEK at rest, Cloud Audit Logs.

```python
print("  End-to-End Encrypted Pipeline: starting...")
```

      End-to-End Encrypted Pipeline: starting...

#### Step 1 — Retrieve credentials from Secret Manager

```python
# Production services never hardcode passwords. The pipeline starts by
# fetching the database password from Secret Manager, which is IAM-protected
# and audit-logged. Only the SA with secretmanager.versions.access can read it.
db_pw_path = f"projects/{PROJECT_ID}/secrets/db-password/versions/latest"
db_pw = sm_client.access_secret_version(name=db_pw_path).payload.data.decode()
print(f"  1. DB password retrieved from Secret Manager")
print(f"     Secret: db-password, length: {len(db_pw)} chars")
```

      1. DB password retrieved from Secret Manager
         Secret: db-password, length: 15 chars

#### Step 2 — Query BigQuery with SA authentication

```python
# BigQuery access is controlled by IAM (roles/bigquery.dataViewer or higher).
# The query runs in the BigQuery engine; data never leaves Google infra
# until the result is returned to the client over TLS.
bq_data = bq_client.query(f"""
    SELECT symbol, close, composite_rank
    FROM `{PROJECT_ID}.{BQ_DATASET}.gold_scores`
    WHERE composite_rank <= 5
    ORDER BY composite_rank
""").to_dataframe()
print(f"  2. Queried BigQuery: {len(bq_data)} rows")
print(bq_data.to_string(index=False))
```

      2. Queried BigQuery: 5 rows
    symbol  close  composite_rank
    ENI.MI  21.34               1
    DB1.DE 237.90               2
    TTE.PA  69.77               3
     AD.AS  41.05               4
    PRX.AS  45.69               5

#### Step 3 — Encrypt query results with Cloud KMS

```python
# Application-layer encryption: the pipeline encrypts the query results
# before writing them anywhere. Even if Firestore or GCS is compromised,
# the data is unreadable without the KMS key.
# This is defense-in-depth on top of the storage-layer encryption.
data_json = bq_data.to_json()
enc_data = kms_client.encrypt(name=key_name, plaintext=data_json.encode()).ciphertext
print(f"  3. Encrypted with KMS: {len(data_json)} bytes plaintext → {len(enc_data)} bytes ciphertext")
print(f"     Key: {KMS_KEYRING}/{KMS_KEY}")
```

      3. Encrypted with KMS: 185 bytes plaintext → 268 bytes ciphertext
         Key: notebook-keyring/notebook-encrypt-key

#### Step 4 — Store encrypted results in Firestore

```python
# Firestore serves as the real-time layer: dashboards and APIs read from here.
# The data is stored already encrypted (application-layer), plus Firestore
# encrypts at rest with Google-managed keys. Double encryption.
# The document includes metadata so consumers know which KMS key to use.
pipeline_ref = fs_client.collection("pipeline_results").document("latest_run")
pipeline_ref.set({  # type: ignore[union-attr]
    "encrypted_data": base64.b64encode(enc_data).decode(),
    "encryption_key": f"{KMS_KEYRING}/{KMS_KEY}",
    "record_count": len(bq_data),
    "pipeline_run_at": firestore.SERVER_TIMESTAMP,
})
print("  4. Written encrypted results to Firestore")
print(f"     Collection: pipeline_results, doc: latest_run")
```

      4. Written encrypted results to Firestore
         Collection: pipeline_results, doc: latest_run

#### Step 5 — Archive encrypted data to CMEK-encrypted GCS

GCS archive layer — three encryption layers: (1) application KMS before upload, (2) CMEK on the bucket, (3) Google infrastructure default.

```python
pipeline_blob = bucket.blob("pipeline/latest_scores.enc")
pipeline_blob.upload_from_string(enc_data)
print("  5. Uploaded to CMEK-encrypted GCS bucket")
print(f"     Path: gs://{BUCKET_NAME}/pipeline/latest_scores.enc")
print(f"     Size: {len(enc_data)} bytes")
print()
print("  Pipeline complete: SA-authenticated + KMS-encrypted + audit-logged")
```

      5. Uploaded to CMEK-encrypted GCS bucket
         Path: gs://seclab-dev-ap-26-data/pipeline/latest_scores.enc
         Size: 268 bytes
    
      Pipeline complete: SA-authenticated + KMS-encrypted + audit-logged

#### Certificate chain inspection — Cloud SQL server certificate

```python
# Inspect the certificate chain used by GCP services
# Cloud SQL, HTTPS endpoints, and other services use Google-managed certificates

print("  Certificate chain for googleapis.com:")
print()

try:
    # Fetch the certificate chain from a Google API endpoint
    context = ssl.create_default_context()
    with socket.create_connection(("bigquery.googleapis.com", 443), timeout=10) as sock:
        with context.wrap_socket(sock, server_hostname="bigquery.googleapis.com") as ssock:
            cert_der = ssock.getpeercert(binary_form=True)
            cert = x509.load_der_x509_certificate(cert_der, default_backend())

            print(f"  Subject:          {cert.subject.rfc4514_string()}")
            print(f"  Issuer:           {cert.issuer.rfc4514_string()}")
            print(f"  Valid from:       {cert.not_valid_before_utc}")
            print(f"  Valid until:      {cert.not_valid_after_utc}")
            print(f"  Serial:           {cert.serial_number}")
            print(f"  Signature alg:    {cert.signature_algorithm_oid._name}")

            # Check SANs
            try:
                san = cert.extensions.get_extension_for_class(x509.SubjectAlternativeName)
                dns_names = san.value.get_values_for_type(x509.DNSName)
                print(f"  SANs:             {', '.join(dns_names[:5])}")
            except Exception:
                pass

except Exception as e:
    print(f"  Certificate inspection: {e}")
    print("  This may fail in restricted network environments")

print()
print("  GCP certificate chain:")
print("    Root CA:        Google Trust Services (GTS Root R1-R4)")
print("    Intermediate:   GTS CA 1C3 / 1D4")
print("    Leaf cert:      *.googleapis.com")
print("    Trust model:    publicly trusted, auto-rotated by Google")
```

      Certificate chain for googleapis.com:
    
      Subject:          CN=upload.video.google.com
      Issuer:           CN=WE2,O=Google Trust Services,C=US
      Valid from:       2026-03-09 08:37:47+00:00
      Valid until:      2026-06-01 08:37:46+00:00
      Serial:           166067327935065613836978431416114692540
      Signature alg:    ecdsa-with-SHA256
      SANs:             upload.video.google.com, *.clients.google.com, *.docs.google.com, *.drive.google.com, *.gdata.youtube.com
    
      GCP certificate chain:
        Root CA:        Google Trust Services (GTS Root R1-R4)
        Intermediate:   GTS CA 1C3 / 1D4
        Leaf cert:      *.googleapis.com
        Trust model:    publicly trusted, auto-rotated by Google

> [!abstract]- Security Operations Audit Summary
>
> **Identity & Authentication:** SA key file, ADC, service account impersonation, short-lived access tokens (600s), Workload Identity Federation (GitHub OIDC), ID vs access token comparison, IAM permissions test
>
> **Secret Manager:** Read/create/rotate/disable/destroy secrets, version pinning, JSON secrets, IAM audit, application caching patterns
>
> **Cloud KMS:** Symmetric encrypt/decrypt, envelope encryption (DEK + KEK), file encryption for GCS, key versioning and rotation, CMEK verification
>
> **Compute Engine:** SSH with Ed25519 key (paramiko), OS Login key management, IAP tunnel, metadata server identity, firewall rules audit
>
> **Cloud SQL:** Password auth (pymssql), SSL server CA certificate inspection, Auth Proxy reference, authorized networks, encryption at rest (CMEK)
>
> **BigQuery:** SA key + impersonated credential queries, column-level KMS encryption, dataset encryption audit, authorized views
>
> **Firestore:** Authenticated CRUD, field-level KMS encryption, IAM-based access control
>
> **Cloud Storage:** CMEK upload/verify, client-side AES-GCM, CSEK (customer-supplied keys), signed URLs (download + upload), IAM policy audit
>
> **Cross-Service:** End-to-end encrypted pipeline, certificate chain inspection

## Cleanup and Cost Control

> ⚠️ **Cost Warning:** Cloud SQL (~$50/month) and Compute Engine VMs incur charges
> even when idle. Always stop them when not in use.

#### Clean up GCS demo files

```python
# Remove demo files created during this notebook
demo_prefixes = ["security-demo/", "encrypted/", "pipeline/"]

for prefix in demo_prefixes:
    blobs = list(bucket.list_blobs(prefix=prefix))
    for blob in blobs:
        blob.delete()
        print(f"  Deleted: gs://{BUCKET_NAME}/{blob.name}")

print(f"  GCS cleanup complete")
```

#### Clean up BigQuery demo resources

```python
# Remove demo views and tables
for table_id in ["gold_scores_public", "encrypted_demo"]:
    full_id = f"{PROJECT_ID}.{BQ_DATASET}.{table_id}"
    bq_client.delete_table(full_id, not_found_ok=True)
    print(f"  Deleted: {full_id}")
```

#### Clean up Firestore demo documents

```python
# Remove pipeline results document
try:
    fs_client.collection("pipeline_results").document("latest_run").delete()
    print("  Deleted: pipeline_results/latest_run")
except Exception as e:
    print(f"  Cleanup: {e}")
```

#### gcloud sql instances patch — stop Cloud SQL to save costs

```python
# Stop the SQL Server instance to avoid charges when not in use
# It takes ~2 minutes to stop and ~5 minutes to restart
!gcloud sql instances patch {SQL_INSTANCE} --activation-policy=NEVER --quiet
print(f"  Stopped: {SQL_INSTANCE}")
print(f"  Restart: gcloud sql instances patch {SQL_INSTANCE} --activation-policy=ALWAYS")
```

#### gcloud compute instances stop — stop VM to save costs

```python
# Stop the VM to avoid compute charges (disk charges still apply)
!gcloud compute instances stop {VM_NAME} --zone={ZONE} --quiet
print(f"  Stopped: {VM_NAME}")
print(f"  Restart: gcloud compute instances start {VM_NAME} --zone={ZONE}")
```

> [!danger]- Full teardown commands (IRREVERSIBLE
>
> Full teardown commands (IRREVERSIBLE — all data will be lost)
> ```bash
> # Delete Cloud SQL instance
> gcloud sql instances delete $SQL_INSTANCE --quiet
>
> # Delete VM
> gcloud compute instances delete $VM_NAME --zone=$ZONE --quiet
>
> # Delete GCS bucket and all contents
> gcloud storage rm -r gs://$BUCKET_NAME
>
> # Delete BigQuery dataset and all tables
> bq rm -r -f $PROJECT_ID:$BQ_DATASET
>
> # Delete Firestore database
> gcloud firestore databases delete --database=$FIRESTORE_DB --quiet
>
> # Delete secrets
> gcloud secrets delete test-api-key --quiet
> gcloud secrets delete db-password --quiet
> gcloud secrets delete db-config --quiet
>
> # Delete Artifact Registry
> gcloud artifacts repositories delete notebook-docker --location=$REGION --quiet
>
> # Delete the entire project (nuclear option)
> gcloud projects delete $PROJECT_ID --quiet
> ```
