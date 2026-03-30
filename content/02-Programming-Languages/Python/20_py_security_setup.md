---
type: reference
category: programming-languages
technology: [python, gcp]
tags: [python, gcp, security, infrastructure]
aliases: [Security Setup, GCP Security Infrastructure, Workload Identity Setup]
keywords: [gcloud, service account, KMS, Secret Manager, Cloud SQL, Workload Identity Federation, OIDC, IAM, CMEK, SSH, Artifact Registry, Compute Engine, BigQuery, Firestore, GCS]
description: "GCP security infrastructure setup — provisions service accounts, KMS keys, secrets, Cloud SQL, Compute Engine, Workload Identity Federation, and populates demo data. Prerequisite for [21_py_security_operations](https://alp78.github.io/elysium/02-Programming-Languages/Python/21_py_security_operations) and [21_cs_security_operations](https://alp78.github.io/elysium/02-Programming-Languages/CSharp/21_cs_security_operations)."
created: 2026-03-27
updated: 2026-03-27
status: complete
---

# 20. Security Setup - Python

> [!quote]
> "There are two kinds of cryptography in this world: cryptography that will stop your kid sister from reading your files, and cryptography that will stop major governments from reading your files."
> — **Bruce Schneier**

> [!tip] Prerequisite Reading
>
> For the theoretical framework behind these operations — identity model, credential types, OAuth2 flows, and connection patterns — see [gcp-identity-and-connection-patterns](https://alp78.github.io/elysium/06-GCP/Security/gcp-identity-and-connection-patterns).

```python
import itertools
import os
import subprocess
import tempfile
from datetime import datetime, timezone
from io import StringIO
from pathlib import Path
from dotenv import load_dotenv
import pyarrow.parquet as pq
from io import BytesIO
from google.cloud import bigquery, firestore, storage
import http.client
import pandas as pd
import pymssql
```

#### Configuration constants

> [!info] Central config
>
> All values known before running any gcloud commands. Cells below reference these constants; do not redefine them elsewhere. Values not yet known (SA key path, SQL password, SSH key) are set later after their resources are created.

```python
PROJECT_ID   = "seclab-dev-ap-26"
PROJECT_NUMBER = "922174528852"
REGION       = "europe-west1"
ZONE         = "europe-west1-b"
SA_NAME      = "notebook-sa"
SA_EMAIL     = f"{SA_NAME}@{PROJECT_ID}.iam.gserviceaccount.com"

KMS_LOCATION = "europe-west1"
KMS_KEYRING  = "notebook-keyring"
KMS_KEY      = "notebook-encrypt-key"

BUCKET_NAME  = f"{PROJECT_ID}-data"
DATA_DIR     = Path(r"C:/Users/aperi/DEV/LANG/data")

SQL_INSTANCE = "notebook-sql"

BQ_DATASET   = "index_data"
FIRESTORE_DB = "seclab-scores"

VM_NAME      = "notebook-vm"
DOCKER_REPO  = f"europe-west1-docker.pkg.dev/{PROJECT_ID}/notebook-docker"

GITHUB_REPO  = "alp78/security-lab"
WIF_POOL     = "github-pool"
WIF_PROVIDER = "github-provider"

os.environ["GCP_SQL_PASSWORD"] = "EsgDev2026Pass1"

print(f"  Project: {PROJECT_ID}  |  SA: {SA_EMAIL}")
```

      Project: seclab-dev-ap-26  |  SA: notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com

```python
# Install all security, cloud and crypto packages needed throughout this notebook
%pip install -q \
    google-cloud-iam \
    google-cloud-secret-manager \
    google-cloud-kms \
    google-cloud-storage \
    google-cloud-bigquery \
    google-cloud-firestore \
    google-cloud-compute \
    google-auth \
    google-auth-oauthlib \
    google-auth-httplib2 \
    cryptography \
    pyopenssl \
    paramiko \
    pymssql \
    requests \
    python-dotenv \
    pyopenssl \
    pandas \
    db-dtypes
```

    Note: you may need to restart the kernel to use updated packages.

## GitHub Repository

#### GitHub gh repo create — public repo for Workload Identity Federation demos

```python
# Workload Identity Federation allows GitHub Actions to authenticate to GCP
# without a service account JSON key. The repo is where CI/CD workflows will run.
!gh repo create alp78/security-lab --public --description "GCP security lab for notebook demos" --clone=false
```

    https://github.com/alp78/security-lab

## GCP Project

#### gcloud projects create — new GCP project

```python
# A project is the top-level container for all GCP resources.
# The project ID must be globally unique across all of Google Cloud.
!gcloud projects create seclab-dev-ap-26 --name="Security Lab"
```

    Create in progress for [https://cloudresourcemanager.googleapis.com/v1/projects/seclab-dev-ap-26].
    Waiting for [operations/create_project.global.7602910978543154749] to finish...
    .done.
    Enabling service [cloudapis.googleapis.com] on project [seclab-dev-ap-26]...
    Operation "operations/acat.p2-922174528852-dacd229c-fa88-4eb5-8fe1-457d3151c07c" finished successfully.

#### gcloud config set project — set default project

```python
# All subsequent gcloud commands will target this project automatically.
!gcloud config set project seclab-dev-ap-26
```

    WARNING: Your active project does not match the quota project in your local Application Default Credentials file. This might result in unexpected quota issues.
    
    To update your Application Default Credentials quota project, use the `gcloud auth application-default set-quota-project` command.
    Updated property [core/project].

## Billing

#### gcloud billing accounts list

```python
# You need the billing account ID to link it to the project.
# Without billing, most APIs and resources cannot be used.
!gcloud billing accounts list
```

    ACCOUNT_ID            NAME                    OPEN   MASTER_ACCOUNT_ID
    0190CF-C61D5A-F08831  Agents Billing Account  True
    01E212-1C5E05-99306D  My Billing Account      False

#### gcloud billing projects link — attach billing account

```python
# This enables paid APIs (Compute Engine, KMS, etc.) on the project.
# Replace the billing account ID with yours if different.
!gcloud billing projects link seclab-dev-ap-26 --billing-account=0190CF-C61D5A-F08831
```

    billingAccountName: billingAccounts/0190CF-C61D5A-F08831
    billingEnabled: true
    name: projects/seclab-dev-ap-26/billingInfo
    projectId: seclab-dev-ap-26

## Enable APIs

#### gcloud services enable — enable required Google Cloud APIs

```python
# Each API must be explicitly enabled before you can use it.
# Enables: Secret Manager, Cloud KMS, Compute Engine, IAM,
# Cloud Storage, Artifact Registry, Certificate Manager, IAM Credentials, STS, Cloud SQL, and BigQuery.

# Secret Manager
!gcloud services enable secretmanager.googleapis.com

# Cloud KMS
!gcloud services enable cloudkms.googleapis.com

# Compute Engine
!gcloud services enable compute.googleapis.com

# IAM
!gcloud services enable iam.googleapis.com

# Cloud Storage
!gcloud services enable storage.googleapis.com

# Artifact Registry
!gcloud services enable artifactregistry.googleapis.com

# Certificate Manager
!gcloud services enable certificatemanager.googleapis.com

# IAM Credentials
!gcloud services enable iamcredentials.googleapis.com

# STS (Security Token Service)
!gcloud services enable sts.googleapis.com

# Cloud SQL Admin + Component
!gcloud services enable sqladmin.googleapis.com sql-component.googleapis.com

# BigQuery
!gcloud services enable bigquery.googleapis.com

# Firestore
!gcloud services enable firestore.googleapis.com

# Cloud Resource Manager
!gcloud services enable cloudresourcemanager.googleapis.com --project=seclab-dev-ap-26
```

    Operation "operations/acat.p2-922174528852-fc2dbaa7-0f6e-4f91-bb2c-3ebc8bd016a9" finished successfully.
    Operation "operations/acat.p2-922174528852-e2964d83-4bd6-464f-9b4a-f06c91a2cdc9" finished successfully.

## Service Account

> [!warning] Service account key leak risk
>
> Service account key files are the #1 cause of credential leaks in GCP.
> Prefer Workload Identity Federation (WIF) over downloaded JSON keys. If you must use
> keys: store them in Secret Manager, never commit them to git, and rotate every 90 days.
> See the Workload Identity Federation section below for the keyless alternative.

#### gcloud iam service-accounts create

```python
# A service account is a non-human identity used by applications, VMs, and CI/CD to authenticate to GCP APIs.
!gcloud iam service-accounts create notebook-sa --display-name="Notebook Service Account"
```

    Created service account [notebook-sa].

#### gcloud iam service-accounts list — verify creation

```python
# Check the service account exists in the project.
!gcloud iam service-accounts list
```

    DISPLAY NAME                            EMAIL                                                 DISABLED
    Notebook Service Account                notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com  False
    Compute Engine default service account  922174528852-compute@developer.gserviceaccount.com    False

#### gcloud iam service-accounts keys create — download JSON key

```python
# The JSON key file contains the private key for the service account.
# NEVER commit this file to git. Store it in .env or a secret manager.
# In production, prefer Workload Identity Federation (keyless) instead.
!gcloud iam service-accounts keys create ./gcp-sa-key.json --iam-account=notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com

os.environ["GCP_SA_KEY_PATH"] = "./gcp-sa-key.json"
print("  GCP_SA_KEY_PATH set")
```

      GCP_SA_KEY_PATH set

    created key [bab344cba7a3761aa8cd8430d2d17e0cb5fe4738] of type [json] as [./gcp-sa-key.json] for [notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com]

## IAM Role Bindings

#### gcloud IAM policy binding — grant Secret Manager Admin

```python
# Allows the service account to create, read, update, and delete secrets.
!gcloud projects add-iam-policy-binding seclab-dev-ap-26 --member="serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com" --role="roles/secretmanager.admin"
```

    bindings:
    - members:
      - serviceAccount:922174528852@cloudservices.gserviceaccount.com
      role: roles/compute.instanceGroupManagerServiceAgent
    - members:
      - serviceAccount:service-922174528852@compute-system.iam.gserviceaccount.com
      role: roles/compute.serviceAgent
    - members:
      - serviceAccount:922174528852-compute@developer.gserviceaccount.com
      role: roles/editor
    - members:
      - user:alexper.recovery@gmail.com
      role: roles/owner
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/secretmanager.admin
    etag: BwZN4IZpV6A=
    version: 1

    Updated IAM policy for project [seclab-dev-ap-26].

#### gcloud IAM policy binding — grant Cloud KMS Encrypter/Decrypter

```python
# Allows encrypting and decrypting data using KMS keys.
!gcloud projects add-iam-policy-binding seclab-dev-ap-26 --member="serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com" --role="roles/cloudkms.cryptoKeyEncrypterDecrypter"
```

    bindings:
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/cloudkms.cryptoKeyEncrypterDecrypter
    - members:
      - serviceAccount:922174528852@cloudservices.gserviceaccount.com
      role: roles/compute.instanceGroupManagerServiceAgent
    - members:
      - serviceAccount:service-922174528852@compute-system.iam.gserviceaccount.com
      role: roles/compute.serviceAgent
    - members:
      - serviceAccount:922174528852-compute@developer.gserviceaccount.com
      role: roles/editor
    - members:
      - user:alexper.recovery@gmail.com
      role: roles/owner
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/secretmanager.admin
    etag: BwZN4IbC-Is=
    version: 1

    Updated IAM policy for project [seclab-dev-ap-26].

#### gcloud kms keys add-iam-policy-binding — grant KMS Viewer

> [!info] Why a separate KMS Viewer role?
>
> `cryptoKeyEncrypterDecrypter` only covers encrypt/decrypt operations but NOT reading key metadata (versions, algorithm, protection level). Without `cloudkms.viewer`, calls to `kms_client.get_crypto_key()` and `list_crypto_key_versions()` raise a 403 PermissionDenied error.

```python
# Grants cloudkms.cryptoKeys.get and list on KMS resources
!gcloud kms keys add-iam-policy-binding notebook-encrypt-key --keyring=notebook-keyring --location=europe-west1 --project=seclab-dev-ap-26 --member="serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com" --role="roles/cloudkms.viewer"
```

    bindings:
    - members:
      - serviceAccount:service-922174528852@gs-project-accounts.iam.gserviceaccount.com
      role: roles/cloudkms.cryptoKeyEncrypterDecrypter
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/cloudkms.viewer
    etag: BwZN4qN7v0E=
    version: 1

    Updated IAM policy for key [notebook-encrypt-key].

#### gcloud IAM policy binding — grant Cloud Storage Admin

```python
# Allows creating buckets, uploading/downloading objects, managing ACLs.
!gcloud projects add-iam-policy-binding seclab-dev-ap-26 --member="serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com" --role="roles/storage.admin"
```

    bindings:
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/cloudkms.cryptoKeyEncrypterDecrypter
    - members:
      - serviceAccount:922174528852@cloudservices.gserviceaccount.com
      role: roles/compute.instanceGroupManagerServiceAgent
    - members:
      - serviceAccount:service-922174528852@compute-system.iam.gserviceaccount.com
      role: roles/compute.serviceAgent
    - members:
      - serviceAccount:922174528852-compute@developer.gserviceaccount.com
      role: roles/editor
    - members:
      - user:alexper.recovery@gmail.com
      role: roles/owner
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/secretmanager.admin
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/storage.admin
    etag: BwZN4IcgGTo=
    version: 1

    Updated IAM policy for project [seclab-dev-ap-26].

#### gcloud IAM policy binding — grant Compute Engine Instance Admin

```python
# Allows creating, starting, stopping VMs and managing SSH keys.
!gcloud projects add-iam-policy-binding seclab-dev-ap-26 --member="serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com" --role="roles/compute.instanceAdmin.v1"
```

    bindings:
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/cloudkms.cryptoKeyEncrypterDecrypter
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/compute.instanceAdmin.v1
    - members:
      - serviceAccount:922174528852@cloudservices.gserviceaccount.com
      role: roles/compute.instanceGroupManagerServiceAgent
    - members:
      - serviceAccount:service-922174528852@compute-system.iam.gserviceaccount.com
      role: roles/compute.serviceAgent
    - members:
      - serviceAccount:922174528852-compute@developer.gserviceaccount.com
      role: roles/editor
    - members:
      - user:alexper.recovery@gmail.com
      role: roles/owner
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/secretmanager.admin
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/storage.admin
    etag: BwZN4IdyixU=
    version: 1

    Updated IAM policy for project [seclab-dev-ap-26].

#### gcloud IAM policy binding — grant Service Account Token Creator

```python
# Allows impersonating the service account and generating access tokens.
# Required for Workload Identity Federation.
!gcloud projects add-iam-policy-binding seclab-dev-ap-26 --member="serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com" --role="roles/iam.serviceAccountTokenCreator"
```

    bindings:
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/cloudkms.cryptoKeyEncrypterDecrypter
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/compute.instanceAdmin.v1
    - members:
      - serviceAccount:922174528852@cloudservices.gserviceaccount.com
      role: roles/compute.instanceGroupManagerServiceAgent
    - members:
      - serviceAccount:service-922174528852@compute-system.iam.gserviceaccount.com
      role: roles/compute.serviceAgent
    - members:
      - serviceAccount:922174528852-compute@developer.gserviceaccount.com
      role: roles/editor
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/iam.serviceAccountTokenCreator
    - members:
      - user:alexper.recovery@gmail.com
      role: roles/owner
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/secretmanager.admin
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/storage.admin
    etag: BwZN4IfCX84=
    version: 1

    Updated IAM policy for project [seclab-dev-ap-26].

#### gcloud IAM policy binding — grant Cloud SQL Admin

```python
# Allows creating and managing Cloud SQL instances, users, databases,
# and SSL client certificates. Required for certificate-based and IAM-federated
# authentication demos.
!gcloud projects add-iam-policy-binding seclab-dev-ap-26 --member="serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com" --role="roles/cloudsql.admin"
```

    bindings:
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/cloudkms.cryptoKeyEncrypterDecrypter
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/cloudsql.admin
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/compute.instanceAdmin.v1
    - members:
      - serviceAccount:922174528852@cloudservices.gserviceaccount.com
      role: roles/compute.instanceGroupManagerServiceAgent
    - members:
      - serviceAccount:service-922174528852@compute-system.iam.gserviceaccount.com
      role: roles/compute.serviceAgent
    - members:
      - serviceAccount:922174528852-compute@developer.gserviceaccount.com
      role: roles/editor
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/iam.serviceAccountTokenCreator
    - members:
      - user:alexper.recovery@gmail.com
      role: roles/owner
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/secretmanager.admin
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/storage.admin
    etag: BwZN4IgQPF4=
    version: 1

    Updated IAM policy for project [seclab-dev-ap-26].

#### gcloud IAM policy binding — grant BigQuery Admin

```python
# Allows creating datasets, tables, and running queries.
# BigQuery supports both SA key auth and Workload Identity Federation.
!gcloud projects add-iam-policy-binding seclab-dev-ap-26 --member="serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com" --role="roles/bigquery.admin"
```

    bindings:
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/bigquery.admin
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/cloudkms.cryptoKeyEncrypterDecrypter
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/cloudsql.admin
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/compute.instanceAdmin.v1
    - members:
      - serviceAccount:922174528852@cloudservices.gserviceaccount.com
      role: roles/compute.instanceGroupManagerServiceAgent
    - members:
      - serviceAccount:service-922174528852@compute-system.iam.gserviceaccount.com
      role: roles/compute.serviceAgent
    - members:
      - serviceAccount:922174528852-compute@developer.gserviceaccount.com
      role: roles/editor
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/iam.serviceAccountTokenCreator
    - members:
      - user:alexper.recovery@gmail.com
      role: roles/owner
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/secretmanager.admin
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/storage.admin
    etag: BwZN4IhfGcM=
    version: 1

    Updated IAM policy for project [seclab-dev-ap-26].

#### gcloud IAM policy binding — grant Firestore Admin

```python
# Allows creating databases, collections, and reading/writing documents.
# Firestore supports SA key auth, Workload Identity, and Firebase Auth rules.
!gcloud projects add-iam-policy-binding seclab-dev-ap-26 --member="serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com" --role="roles/datastore.owner"
```

    bindings:
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/bigquery.admin
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/cloudkms.cryptoKeyEncrypterDecrypter
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/cloudsql.admin
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/compute.instanceAdmin.v1
    - members:
      - serviceAccount:922174528852@cloudservices.gserviceaccount.com
      role: roles/compute.instanceGroupManagerServiceAgent
    - members:
      - serviceAccount:service-922174528852@compute-system.iam.gserviceaccount.com
      role: roles/compute.serviceAgent
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/datastore.owner
    - members:
      - serviceAccount:922174528852-compute@developer.gserviceaccount.com
      role: roles/editor
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/iam.serviceAccountTokenCreator
    - members:
      - user:alexper.recovery@gmail.com
      role: roles/owner
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/secretmanager.admin
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/storage.admin
    etag: BwZN4IiM3OE=
    version: 1

    Updated IAM policy for project [seclab-dev-ap-26].

## Cloud KMS

#### gcloud kms keyrings create — KMS key ring

```python
# A key ring is a logical grouping of cryptographic keys.
# Key rings cannot be deleted once created - choose the location carefully.
!gcloud kms keyrings create notebook-keyring --location=europe-west1
```

#### gcloud kms keys create — symmetric encryption key

```python
# A symmetric key encrypts and decrypts with the same key.
# Used for envelope encryption: encrypt your data key with this KMS key.
!gcloud kms keys create notebook-encrypt-key --location=europe-west1 --keyring=notebook-keyring --purpose=encryption --protection-level=software
```

## Secret Manager

> [!danger] Never store secrets in environment
>
> Never store secrets in environment variables in Docker images or git repos
> Environment variables are visible in `docker inspect`, process listings, and build logs.
> Use Secret Manager with IAM bindings to control access. The helper below writes secret
> values to temp files — these are deleted after creation, but ensure `/tmp` is not
> world-readable on shared systems.

> [!warning] Secret versions are immutable and billable
>
> Each `add-version` creates a new immutable version. Old versions remain accessible (and
> billable) until explicitly destroyed. Use `gcloud secrets versions destroy` to clean up
> old versions after rotation.

#### Helper: create secret from value

> [!warning] Windows gcloud secret creation workaround
>
> On Windows, `echo -n value | gcloud ...` does not work: `cmd.exe` has no `-n` flag, so echo outputs the literal text `-n value`. The workaround is to write the secret value to a temp file and pass its path via `--data-file`. Forward slashes are required because gcloud on Windows rejects backslash paths inside f-strings.

> [!info] --replication-policy=automatic
>
> Secret Manager replicates the secret across multiple regions automatically. The alternative is `user-managed`, which lets you choose specific regions but requires extra configuration.

```python
def gcloud_secret_create(name, value, project=PROJECT_ID):
    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False, encoding="utf-8") as f:
        f.write(value)
        tmp = f.name
    tmp = tmp.replace("\\", "/")
    r = subprocess.run(
        f"gcloud secrets create {name} --data-file={tmp} --replication-policy=automatic --project={project}",
        shell=True, capture_output=True, text=True
    )
    os.unlink(tmp)
    print(r.stdout or r.stderr)
```

#### Create secret: API key

```python
!gcloud secrets delete test-api-key --project=seclab-dev-ap-26 --quiet
```

    Deleted secret [test-api-key].

```python
# Secrets are versioned - each add-version creates a new version.
# The --data-file=- flag reads the secret value from stdin (the pipe).
gcloud_secret_create("test-api-key", "sk_test_dummy_api_key_12345")
```

    Created version [1] of the secret [test-api-key].

#### Create secret: database password

```python
!gcloud secrets delete db-password --project=seclab-dev-ap-26 --quiet
```

    Deleted secret [db-password].

```python
# Store the database password as a managed secret.
gcloud_secret_create("db-password", "EsgDev2026Pass1")
```

    Created version [1] of the secret [db-password].

#### Create secret: db-config

```python
!gcloud secrets delete db-config --project=seclab-dev-ap-26 --quiet
```

    Deleted secret [db-config].

```python
# Secrets can store any string - JSON configs, connection strings, certificates.
gcloud_secret_create("db-config", f'{"host":"{SQL_IP}","port":1433,"database":"stoxx"}')
```

    Created version [1] of the secret [db-config].

## Cloud Storage

#### gcloud storage buckets create — GCS bucket

```python
# A bucket is a container for objects (files) in Cloud Storage.
# Bucket names are globally unique.
!gcloud storage buckets create gs://seclab-dev-ap-26-data --location=europe-west1
```

    Creating gs://seclab-dev-ap-26-data/...

#### gcloud storage buckets update — enable CMEK encryption

```python
# CMEK (Customer-Managed Encryption Key) uses your KMS key to encrypt
# all objects in the bucket. Without this, Google manages the encryption key.
!gcloud storage buckets update gs://seclab-dev-ap-26-data --default-encryption-key=projects/seclab-dev-ap-26/locations/europe-west1/keyRings/notebook-keyring/cryptoKeys/notebook-encrypt-key
```

      
    .......Updating gs://seclab-dev-ap-26-data/...
    .....................................

## Compute Engine

#### gcloud compute instances create — VM instance

```python
# An e2-micro is the smallest (and free-tier eligible) VM.
# We'll use it to demo SSH key auth, SCP file transfer, and remote execution.
!gcloud compute instances create notebook-vm --zone=europe-west1-b --machine-type=e2-micro --image-family=debian-12 --image-project=debian-cloud --tags=ssh-server
```

    NAME         ZONE            MACHINE_TYPE  PREEMPTIBLE  INTERNAL_IP  EXTERNAL_IP    STATUS
    notebook-vm  europe-west1-b  e2-micro                   10.132.0.2   34.76.141.248  RUNNING

    Created [https://www.googleapis.com/compute/v1/projects/seclab-dev-ap-26/zones/europe-west1-b/instances/notebook-vm].

#### gcloud compute firewall-rules create — SSH access

```python
# Allows TCP port 22 (SSH) from any IP to VMs tagged ssh-server.
# In production, restrict --source-ranges to your IP only.
!gcloud compute firewall-rules create allow-ssh --allow=tcp:22 --target-tags=ssh-server --source-ranges=0.0.0.0/0
```

    NAME       NETWORK  DIRECTION  PRIORITY  ALLOW   DENY  DISABLED
    allow-ssh  default  INGRESS    1000      tcp:22        False

    Creating firewall...
    ..Created [https://www.googleapis.com/compute/v1/projects/seclab-dev-ap-26/global/firewalls/allow-ssh].
    done.

#### gcloud compute instances describe — get VM external IP

```python
# This is the public IP you'll SSH into.
!gcloud compute instances describe notebook-vm --zone=europe-west1-b --format="get(networkInterfaces[0].accessConfigs[0].natIP)"
```

    34.76.141.248

#### gcloud compute instances add-metadata — enable OS Login

> [!info] OS Login metadata flag
>
> Enables SSH authentication via Google identity rather than manually managed `authorized_keys` files. Without this flag, the VM uses standard key-based auth and OS Login commands (`gcloud compute os-login ssh-keys add`) have no effect. Must be set before uploading SSH keys to OS Login.

```python
!gcloud compute instances add-metadata notebook-vm --zone=europe-west1-b --project=seclab-dev-ap-26 --metadata=enable-oslogin=TRUE
```

    Updated [https://www.googleapis.com/compute/v1/projects/seclab-dev-ap-26/zones/europe-west1-b/instances/notebook-vm].

#### gcloud compute ssh — install pip on VM

Debian 12 ships Python 3.11 without pip. `ensurepip` is disabled by the OS, so pip must be installed via apt. The `--fix-missing` flag is needed because the Debian security repo sometimes has unavailable packages.

```python
!gcloud compute ssh notebook-vm --zone=europe-west1-b --project=seclab-dev-ap-26 \
    --strict-host-key-checking=no \
    --command="sudo DEBIAN_FRONTEND=noninteractive apt-get install -y python3-pip --fix-missing"
```

    Reading package lists...
    Building dependency tree...
    Reading state information...
    python3-pip is already the newest version (23.0.1+dfsg-1).
    The following packages were automatically installed and are no longer required:
      cpp cpp-12 fakeroot fontconfig-config fonts-dejavu-core javascript-common
      libabsl20220623 libalgorithm-diff-perl libalgorithm-diff-xs-perl
      libalgorithm-merge-perl libaom3 libasan8 libatomic1 libavif15 libc-dev-bin
      libc-devtools libcc1-0 libcrypt-dev libdav1d6 libde265-0 libdeflate0
      libdpkg-perl libfakeroot libfile-fcntllock-perl libfontconfig1 libgav1-1
      libgd3 libgomp1 libheif1 libisl23 libitm1 libjbig0 libjpeg62-turbo
      libjs-jquery libjs-sphinxdoc libjs-underscore liblerc4 liblsan0 libmpc3
      libmpfr6 libnsl-dev libnuma1 libpython3.11 libquadmath0 librav1e0
      libsvtav1enc1 libtiff6 libtirpc-dev libtsan2 libubsan1 libwebp7 libx11-6
      libx11-data libx265-199 libxau6 libxcb1 libxdmcp6 libxpm4 libyuv0
      manpages-dev patch rpcsvc-proto
    Use 'sudo apt autoremove' to remove them.
    0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.

#### gcloud compute ssh — install Python packages on VM

Installs the packages needed for GCS upload benchmarking. Debian 12 enforces PEP 668 (externally managed Python), so `--break-system-packages` is required to install into the system Python rather than a venv.

```python
!gcloud compute ssh notebook-vm --zone=europe-west1-b --project=seclab-dev-ap-26 \
    --strict-host-key-checking=no \
    --command="pip3 install --break-system-packages google-cloud-storage pyarrow pandas"
```

    Defaulting to user installation because normal site-packages is not writeable
    Requirement already satisfied: google-cloud-storage in ./.local/lib/python3.11/site-packages (3.10.1)
    Requirement already satisfied: pyarrow in ./.local/lib/python3.11/site-packages (23.0.1)
    Requirement already satisfied: pandas in ./.local/lib/python3.11/site-packages (3.0.1)
    Requirement already satisfied: google-auth<3.0.0,>=2.26.1 in ./.local/lib/python3.11/site-packages (from google-cloud-storage) (2.49.1)
    Requirement already satisfied: google-api-core<3.0.0,>=2.27.0 in ./.local/lib/python3.11/site-packages (from google-cloud-storage) (2.30.0)
    Requirement already satisfied: google-cloud-core<3.0.0,>=2.4.2 in ./.local/lib/python3.11/site-packages (from google-cloud-storage) (2.5.0)
    Requirement already satisfied: google-resumable-media<3.0.0,>=2.7.2 in ./.local/lib/python3.11/site-packages (from google-cloud-storage) (2.8.0)
    Requirement already satisfied: requests<3.0.0,>=2.22.0 in /usr/lib/python3/dist-packages (from google-cloud-storage) (2.28.1)
    Requirement already satisfied: google-crc32c<2.0.0,>=1.1.3 in ./.local/lib/python3.11/site-packages (from google-cloud-storage) (1.8.0)
    Requirement already satisfied: numpy>=1.26.0 in ./.local/lib/python3.11/site-packages (from pandas) (2.4.3)
    Requirement already satisfied: python-dateutil>=2.8.2 in ./.local/lib/python3.11/site-packages (from pandas) (2.9.0.post0)
    Requirement already satisfied: googleapis-common-protos<2.0.0,>=1.56.3 in ./.local/lib/python3.11/site-packages (from google-api-core<3.0.0,>=2.27.0->google-cloud-storage) (1.73.0)
    Requirement already satisfied: protobuf<7.0.0,>=4.25.8 in ./.local/lib/python3.11/site-packages (from google-api-core<3.0.0,>=2.27.0->google-cloud-storage) (6.33.6)
    Requirement already satisfied: proto-plus<2.0.0,>=1.22.3 in ./.local/lib/python3.11/site-packages (from google-api-core<3.0.0,>=2.27.0->google-cloud-storage) (1.27.1)
    Requirement already satisfied: pyasn1-modules>=0.2.1 in ./.local/lib/python3.11/site-packages (from google-auth<3.0.0,>=2.26.1->google-cloud-storage) (0.4.2)
    Requirement already satisfied: cryptography>=38.0.3 in ./.local/lib/python3.11/site-packages (from google-auth<3.0.0,>=2.26.1->google-cloud-storage) (46.0.6)
    Requirement already satisfied: six>=1.5 in /usr/lib/python3/dist-packages (from python-dateutil>=2.8.2->pandas) (1.16.0)
    Requirement already satisfied: cffi>=2.0.0 in ./.local/lib/python3.11/site-packages (from cryptography>=38.0.3->google-auth<3.0.0,>=2.26.1->google-cloud-storage) (2.0.0)
    Requirement already satisfied: pyasn1<0.7.0,>=0.6.1 in ./.local/lib/python3.11/site-packages (from pyasn1-modules>=0.2.1->google-auth<3.0.0,>=2.26.1->google-cloud-storage) (0.6.3)
    Requirement already satisfied: pycparser in ./.local/lib/python3.11/site-packages (from cffi>=2.0.0->cryptography>=38.0.3->google-auth<3.0.0,>=2.26.1->google-cloud-storage) (3.0)

#### gcloud compute ssh — verify VM Python environment

```python
!gcloud compute ssh notebook-vm --zone=europe-west1-b --project=seclab-dev-ap-26 \
    --strict-host-key-checking=no \
    --command="python3 -c 'import google.cloud.storage, pyarrow, pandas; print(\"all ok\")'"
```

    all ok

## Cloud SQL

#### Provision Cloud SQL service agent

```python
# Provision the Cloud SQL service agent. This internal service account
# is auto-created on first SQL instance creation, but we need it to exist
# before that so we can grant it KMS access for CMEK encryption.
!gcloud beta services identity create --service=sqladmin.googleapis.com --project={PROJECT_ID}
```

    Service identity created: service-922174528852@gcp-sa-cloud-sql.iam.gserviceaccount.com

#### Grant Cloud SQL service agent access to KMS key

> [!warning] Cloud SQL service agent is NOT your service account
>
> Cloud SQL uses a Google-managed service agent (`service-PROJECT_NUMBER@gcp-sa-cloud-sql.iam.gserviceaccount.com`) to encrypt/decrypt disks. This is NOT the `notebook-sa` we created -- it is an internal agent auto-provisioned by Google when the Cloud SQL API is enabled. It must have `cryptoKeyEncrypterDecrypter` on the KMS key BEFORE the instance is created with `--disk-encryption-key`.

```python
!gcloud kms keys add-iam-policy-binding {KMS_KEY} --keyring={KMS_KEYRING} --location={KMS_LOCATION} --project={PROJECT_ID} --member="serviceAccount:service-{PROJECT_NUMBER}@gcp-sa-cloud-sql.iam.gserviceaccount.com" --role="roles/cloudkms.cryptoKeyEncrypterDecrypter"
```

    bindings:
    - members:
      - serviceAccount:service-922174528852@gcp-sa-cloud-sql.iam.gserviceaccount.com
      - serviceAccount:service-922174528852@gs-project-accounts.iam.gserviceaccount.com
      role: roles/cloudkms.cryptoKeyEncrypterDecrypter
    - members:
      - serviceAccount:notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com
      role: roles/cloudkms.viewer
    etag: BwZN5GYfRf4=
    version: 1

    Updated IAM policy for key [notebook-encrypt-key].

#### gcloud sql instances create — SQL Server with SSL and CMEK

> [!info] Cloud SQL for SQL Server 2022 Express instance flags
>
> - SSL required -- all connections must use TLS certificates
> - `db-custom-1-3840` -- smallest tier for SQL Server (1 vCPU, 3.75 GB RAM, ~$50/month -- stop when not in use)
> - SQL Server Express -- free license, limited to 10 GB per database
> - `--quiet` is required otherwise the command hangs waiting for confirmation

> [!info] CMEK vs Google-managed encryption
>
> **Google-managed** (default, no `--disk-encryption-key`):
> - Google creates, owns, and rotates the encryption key automatically
> - Zero maintenance -- nothing to configure or monitor
> - Google infrastructure (with sufficient access) could theoretically decrypt
> - Sufficient for most workloads where you trust GCP as a provider
>
> **CMEK** (`--disk-encryption-key` pointing to your Cloud KMS key):
> - You own the key in KMS; you control rotation, access, and lifecycle
> - You can revoke access instantly by disabling the key -- data becomes permanently unreadable, even by Google
> - Required for: financial services, healthcare (HIPAA), government (FedRAMP), any compliance framework that mandates customer-controlled encryption
> - Maintenance cost: ensure the KMS key is never accidentally destroyed (data loss is permanent), monitor key access, and manage rotation
> - Adds ~$0.06/month per key version + API call costs
> - Cannot be changed after instance creation -- must delete and recreate

> [!tip] When CMEK is NOT necessary
>
> - Dev/test environments where data is not sensitive
> - Public datasets or non-regulated workloads
> - When your threat model trusts Google as a cloud provider

> [!info] Cloud SQL for SQL Server authentication methods
>
> - Password auth -- traditional SQL Server login (sa password set here)
> - SSL/TLS encryption -- server certificate validates the instance identity
> - Active Directory integration -- Windows auth via Managed AD (enterprise)
> - Private IP -- VPC-only access (no public endpoint)

```python
# ~5-10 min to provision
!gcloud sql instances create notebook-sql --database-version=SQLSERVER_2022_EXPRESS --tier=db-custom-1-3840 --region=europe-west1 --root-password=SecLabPass2026 --disk-encryption-key=projects/seclab-dev-ap-26/locations/europe-west1/keyRings/notebook-keyring/cryptoKeys/notebook-encrypt-key --quiet
```

    NAME          DATABASE_VERSION        LOCATION        TIER              PRIMARY_ADDRESS  PRIVATE_ADDRESS  STATUS
    notebook-sql  SQLSERVER_2022_EXPRESS  europe-west1-b  db-custom-1-3840  34.22.129.89     -                RUNNABLE

    WARNING: You are creating a Cloud SQL instance encrypted with a customer-managed key. If anyone destroys a customer-managed key, all data encrypted with it will be permanently lost.
    
    Creating Cloud SQL instance for SQLSERVER_2022_EXPRESS...
    ..................done.
    Created [https://sqladmin.googleapis.com/sql/v1beta4/projects/seclab-dev-ap-26/instances/notebook-sql].

```python
# check the SQL instance
!gcloud sql instances describe notebook-sql --project=seclab-dev-ap-26 --format="value(state)"
```

    RUNNABLE

#### Get SQL instance IP and save to .env

```python
# Retrieve the public IP assigned to the Cloud SQL instance after provisioning
# and persist it to .env so subsequent cells can read it without re-querying.
sql_ip = subprocess.run(
    "gcloud sql instances describe notebook-sql --project=seclab-dev-ap-26 --format=value(ipAddresses[0].ipAddress)",
    shell=True, capture_output=True, text=True
).stdout.strip()

with open(".env", "a") as f:
    print(f"GCP_SQL_IP={sql_ip}", file=f)

load_dotenv(override=True)
print(f"  GCP_SQL_IP={sql_ip} written to .env")
```

      GCP_SQL_IP=34.22.129.89 written to .env

#### gcloud sql instances patch — authorize current IP

```python
# Cloud SQL only accepts connections from explicitly authorized IPs.
# This patches the allowlist with your current public IP (~5 min to apply).
# Re-running is safe — it replaces the full list with your current IP.
conn = http.client.HTTPSConnection("api.ipify.org")
conn.request("GET", "/")
my_ip = conn.getresponse().read().decode().strip()
conn.close()
print(f"  Your public IP: {my_ip}")

subprocess.run(
    f"gcloud sql instances patch {SQL_INSTANCE} --project={PROJECT_ID} --authorized-networks={my_ip}/32 --quiet",
    shell=True
)
print("  Authorized")
```

      Your public IP: 86.49.254.2
      Authorized

```python
# check if IP was successfully authorized
!gcloud sql instances describe notebook-sql --project=seclab-dev-ap-26 --format="value(settings.ipConfiguration.authorizedNetworks)"
```

    {'kind': 'sql#aclEntry', 'name': '', 'value': '86.49.254.2/32'}

## Populate Data

#### Set service account credentials

```python
# Set credentials for Python client libraries.
# Points to the SA key created earlier in this notebook.
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "./gcp-sa-key.json"
print(f"  Credentials: {os.environ['GOOGLE_APPLICATION_CREDENTIALS']}")
print(f"  File exists: {os.path.exists(os.environ['GOOGLE_APPLICATION_CREDENTIALS'])}")
```

      Credentials: ./gcp-sa-key.json
      File exists: True

#### google-cloud-storage Client — upload local data files to GCS

```python
# Upload all CSV/JSON/Parquet files from the local data folder to GCS.
# Organizes by format: bronze/csv/, bronze/json/, bronze/parquet/

gcs = storage.Client(project=PROJECT_ID)
bucket = gcs.bucket(BUCKET_NAME)

content_types = {".csv": "text/csv", ".json": "application/json", ".parquet": "application/octet-stream"}
total_bytes = 0

for ext, ctype in content_types.items():
    folder = ext.lstrip(".")
    files = sorted(DATA_DIR.glob(f"*{ext}"))
    print(f"{folder.upper()} ({len(files)} files):")
    for f in files[:5]:
        blob_path = f"bronze/{folder}/{f.name}"
        blob = bucket.blob(blob_path)
        blob.upload_from_filename(str(f), content_type=ctype)
        size = f.stat().st_size
        total_bytes += size
        print(f"    {f.name:40s} {size:>12,} bytes")

print(f"Total uploaded: {total_bytes:,} bytes ({total_bytes / 1024 / 1024:.1f} MB)")
```

    CSV (13 files):
        dim_country.csv                                 2,896 bytes
        dim_index.csv                                     247 bytes
        eurostoxx50_ohlcv.csv                       5,285,917 bytes
        index_dim.csv                                 284,715 bytes
        index_performance.csv                         962,688 bytes
    JSON (13 files):
        dim_country.json                               13,281 bytes
        dim_index.json                                    610 bytes
        eurostoxx50_ohlcv.json                     18,092,342 bytes
        index_dim.json                                380,710 bytes
        index_performance.json                      2,490,989 bytes
    PARQUET (13 files):
        dim_country.parquet                             5,089 bytes
        dim_index.parquet                               3,545 bytes
        eurostoxx50_ohlcv.parquet                   2,484,896 bytes
        index_dim.parquet                             148,483 bytes
        index_performance.parquet                     353,159 bytes
    Total uploaded: 30,509,567 bytes (29.1 MB)

#### Create stoxx database in SQL instance and load tables from GCS

> [!info] Bulk load flow
>
> Creates the stoxx database on Cloud SQL and bulk-loads tables from GCS parquet files. Uses bcp (bulk copy program) for fast server-side insertion instead of row-by-row. Flow: GCS parquet -> pyarrow -> temp TSV -> bcp bulk insert. Re-running is safe: tables are truncated before re-insert.

> [!tip] Why bcp instead of executemany
>
> bcp uses the TDS bulk insert protocol which sends rows as a binary stream in a single network operation. By contrast, `executemany` issues one INSERT statement per row (or per chunk), each requiring a full SQL parse/compile cycle and a network round-trip. For 66k rows, bcp completes in seconds where `executemany` takes 5-10+ minutes over the internet.

```python
load_dotenv()
SQL_IP       = os.environ["GCP_SQL_IP"]
SQL_PASSWORD = os.environ["GCP_SQL_PASSWORD"]
BUCKET_NAME  = os.environ["GCP_BUCKET"]
PROJECT_ID   = os.environ["GCP_PROJECT"]

gcs = storage.Client(project=PROJECT_ID)
bkt = gcs.bucket(BUCKET_NAME)

# Step 1: create stoxx database
conn0 = pymssql.connect(server=SQL_IP, user="sqlserver", password=SQL_PASSWORD, port="1433")
conn0.autocommit(True)
cur0 = conn0.cursor()
cur0.execute("IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'stoxx') CREATE DATABASE stoxx")
print("  Database stoxx: ready")
cur0.close(); conn0.close()

# Step 2: create tables and bulk-load via bcp
conn = pymssql.connect(server=SQL_IP, user="sqlserver", password=SQL_PASSWORD, port="1433", database="stoxx")
cursor = conn.cursor()

tables = [
    "dim_country", "dim_index", "eurostoxx50_ohlcv", "index_dim", "index_performance",
    "oil20_ohlcv", "pulse", "scores_daily", "scores_quarterly", "signals_daily",
    "signals_quarterly", "stoxxusa50_ohlcv", "trading_calendar",
]

for tbl in tables:
    print(f"  {tbl}...", end=" ", flush=True)

    # Download parquet from GCS and read with pyarrow
    blob = bkt.blob(f"bronze/parquet/{tbl}.parquet")
    table = pq.read_table(BytesIO(blob.download_as_bytes()))
    df = table.to_pandas()

    # Create table if not exists, then truncate
    col_defs = ", ".join(f"[{c}] NVARCHAR(MAX) NULL" for c in df.columns)
    cursor.execute(f"IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = '{tbl}') CREATE TABLE [{tbl}] ({col_defs})")
    cursor.execute(f"IF OBJECT_ID('{tbl}', 'U') IS NOT NULL TRUNCATE TABLE [{tbl}]")
    conn.commit()

    # Write temp TSV (tab-delimited, no quoting issues with financial data)
    tmp = os.path.join(tempfile.gettempdir(), f"{tbl}.tsv").replace("\\", "/")
    df.to_csv(tmp, index=False, sep="	")

    # Bulk load with bcp (TDS bulk insert protocol)
    r = subprocess.run(
        ["bcp",
         f"stoxx.dbo.{tbl}",          # target: database.schema.table
         "in", tmp,                    # direction + source file
         "-S", f"{SQL_IP},1433",       # server address and port
         "-U", "sqlserver",            # SQL auth username
         "-P", SQL_PASSWORD,           # SQL auth password
         "-c",                         # character mode (text, not native binary)
         "-t", "	",                   # field terminator: tab
         "-F", "2",                    # start at row 2 (skip header)
         "-b", "5000",                 # commit every 5000 rows
         "-u"],                        # trust server certificate (Cloud SQL)
        capture_output=True, text=True
    )
    os.unlink(tmp)

    if r.returncode == 0:
        print(f"{len(df):>6d} rows")
    else:
        print(f"FAILED: {(r.stderr or r.stdout).strip()[:200]}")

cursor.close(); conn.close()
print("All tables loaded into stoxx.")
```

      Database stoxx: ready
      dim_country...    212 rows
      dim_index...      4 rows
      eurostoxx50_ohlcv...  66355 rows
      index_dim...    169 rows
      index_performance...   5281 rows
      oil20_ohlcv...  24738 rows
      pulse...     40 rows
      scores_daily...    466 rows
      scores_quarterly...    170 rows
      signals_daily...    466 rows
      signals_quarterly...    177 rows
      stoxxusa50_ohlcv...  65100 rows
      trading_calendar...  29335 rows
    All tables loaded into stoxx.

#### google-cloud-bigquery Client — load OHLCV into BigQuery (bronze/silver/gold)

```python
# Load Euro Stoxx 50 OHLCV from local CSV into BigQuery bronze layer,
# then compute silver (daily returns) and gold (scores/rankings) tables.

bq = bigquery.Client(project=PROJECT_ID)

# Create dataset if not exists
dataset_ref = bigquery.Dataset(f'{PROJECT_ID}.{BQ_DATASET}')
dataset_ref.location = 'europe-west1'
try:
    bq.create_dataset(dataset_ref)
    print(f'  Created dataset {BQ_DATASET}')
except Exception:
    print(f'  Dataset {BQ_DATASET} already exists')

# Load from GCS
gcs = storage.Client(project=PROJECT_ID)
blob = gcs.bucket(BUCKET_NAME).blob("bronze/csv/eurostoxx50_ohlcv.csv")
ohlcv_df = pd.read_csv(StringIO(blob.download_as_text(encoding="utf-8")))
ohlcv_df['date'] = pd.to_datetime(ohlcv_df['date']).dt.date
ohlcv_df['_ingested_at'] = datetime.now(tz=timezone.utc)
print(f'  Loaded {len(ohlcv_df)} rows from local CSV')

# Load into bronze
table_id = f'{PROJECT_ID}.{BQ_DATASET}.bronze_ohlcv'
job_config = bigquery.LoadJobConfig(write_disposition='WRITE_TRUNCATE')
job = bq.load_table_from_dataframe(ohlcv_df, table_id, job_config=job_config)
job.result()
print(f'  Bronze: {job.output_rows} rows loaded into {table_id}')

# Bronze -> Silver (add daily returns)
silver_sql = f'''
    SELECT *,
        SAFE_DIVIDE(close - LAG(close) OVER (PARTITION BY symbol ORDER BY date),
                    LAG(close) OVER (PARTITION BY symbol ORDER BY date)) AS daily_return
    FROM `{PROJECT_ID}.{BQ_DATASET}.bronze_ohlcv`
'''
silver_table = f'{PROJECT_ID}.{BQ_DATASET}.silver_ohlcv'
job_config = bigquery.QueryJobConfig(destination=silver_table, write_disposition='WRITE_TRUNCATE')
job = bq.query(silver_sql, job_config=job_config)
job.result()
print(f'  Silver: {bq.get_table(silver_table).num_rows} rows')

# Silver -> Gold (compute scores)
gold_sql = f'''
    WITH latest AS (
        SELECT symbol, date AS score_date, close, daily_return, volume,
            AVG(close) OVER (PARTITION BY symbol ORDER BY date ROWS BETWEEN 29 PRECEDING AND CURRENT ROW) AS sma_30,
            STDDEV(daily_return) OVER (PARTITION BY symbol ORDER BY date ROWS BETWEEN 29 PRECEDING AND CURRENT ROW) AS volatility_30d,
            AVG(CAST(volume AS FLOAT64)) OVER (PARTITION BY symbol ORDER BY date ROWS BETWEEN 9 PRECEDING AND CURRENT ROW) AS avg_volume_10d,
            ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date DESC) AS rn
        FROM `{PROJECT_ID}.{BQ_DATASET}.silver_ohlcv`
    )
    SELECT symbol, score_date, close, daily_return,
        volatility_30d, avg_volume_10d,
        SAFE_DIVIDE(close - sma_30, sma_30) AS momentum_score,
        SAFE_DIVIDE(CAST(volume AS FLOAT64), avg_volume_10d) AS volume_score,
        RANK() OVER (ORDER BY SAFE_DIVIDE(close - sma_30, sma_30) DESC) AS composite_rank,
        CURRENT_TIMESTAMP() AS _scored_at
    FROM latest WHERE rn = 1
'''
gold_table = f'{PROJECT_ID}.{BQ_DATASET}.gold_scores'
job_config = bigquery.QueryJobConfig(destination=gold_table, write_disposition='WRITE_TRUNCATE')
job = bq.query(gold_sql, job_config=job_config)
job.result()
print(f'  Gold: {bq.get_table(gold_table).num_rows} rows')

# Display gold scores
print('\n  Gold Scores:')
results = bq.query(f'''
    SELECT symbol, score_date, ROUND(close, 2) AS close,
        ROUND(momentum_score * 100, 2) AS momentum_pct,
        ROUND(volume_score, 2) AS vol_ratio,
        composite_rank
    FROM `{gold_table}` ORDER BY composite_rank
''')
for row in itertools.islice(results, 5):
    print(f'  {row.composite_rank:>2d}. {row.symbol:10s} close={row.close:>8.2f}  momentum={row.momentum_pct:>+6.2f}%  vol_ratio={row.vol_ratio:.2f}')
```

      Dataset index_data already exists
      Loaded 66355 rows from local CSV
      Bronze: 66355 rows loaded into seclab-dev-ap-26.index_data.bronze_ohlcv
      Silver: 66355 rows
      Gold: 50 rows
    
      Gold Scores:
       1. ENI.MI     close=   21.34  momentum=+12.74%  vol_ratio=0.31
       2. DB1.DE     close=  237.90  momentum= +6.98%  vol_ratio=0.18
       3. TTE.PA     close=   69.77  momentum= +6.47%  vol_ratio=0.20
       4. AD.AS      close=   41.05  momentum= +5.54%  vol_ratio=0.12
       5. PRX.AS     close=   45.69  momentum= +3.28%  vol_ratio=0.19

#### gcloud firestore databases create

```python
# Create a named Firestore database (not the default).
# Native mode is required for real-time listeners and subcollections.
!gcloud firestore databases create --database=seclab-scores --location=europe-west1 --type=firestore-native --project=seclab-dev-ap-26
```

    done: true
    metadata:
      '@type': type.googleapis.com/google.firestore.admin.v1.CreateDatabaseMetadata
    name: projects/seclab-dev-ap-26/databases/seclab-scores/operations/AaGw-XDDW5m4QfOmkg4LfBAqMXRzZXctZXBvcnVlDCIFEAGTxKuoEAbOkcbxCAwKMBo
    response:
      '@type': type.googleapis.com/google.firestore.admin.v1.Database
      appEngineIntegrationMode: DISABLED
      concurrencyMode: PESSIMISTIC
      createTime: '2026-03-25T22:36:33.309401Z'
      databaseEdition: STANDARD
      deleteProtectionState: DELETE_PROTECTION_DISABLED
      earliestVersionTime: '2026-03-25T22:36:33.309401Z'
      etag: IOWT/7KOvJMDMNnt/rKOvJMD
      freeTier: true
      locationId: europe-west1
      name: projects/seclab-dev-ap-26/databases/seclab-scores
      pointInTimeRecoveryEnablement: POINT_IN_TIME_RECOVERY_DISABLED
      realtimeUpdatesMode: REALTIME_UPDATES_MODE_ENABLED
      type: FIRESTORE_NATIVE
      uid: 7c0b0e92-a6f3-41b8-995b-c370f9b0a101
      updateTime: '2026-03-25T22:36:33.309401Z'
      versionRetentionPeriod: 3600s

#### google-cloud-firestore Client — write gold scores to Firestore

```python
# Write the gold scores from BigQuery into Firestore for real-time access.
# Firestore serves as the real-time layer — dashboards read from here.

db = firestore.Client(project=PROJECT_ID, database=FIRESTORE_DB)
bq_client = bigquery.Client(project=PROJECT_ID)

results = bq_client.query(f'SELECT * FROM `{PROJECT_ID}.{BQ_DATASET}.gold_scores` ORDER BY composite_rank')

batch = db.batch()
count = 0
for row in results:
    doc_ref = db.collection('scores_latest').document(row.symbol)
    batch.set(doc_ref, {
        'symbol': row.symbol,
        'close': row.close,
        'daily_return': row.daily_return,
        'momentum_score': row.momentum_score,
        'volume_score': row.volume_score,
        'composite_rank': row.composite_rank,
        'updated_at': datetime.now(tz=timezone.utc),
    })
    count += 1

batch.commit()
print(f'  Written {count} scores to Firestore ({FIRESTORE_DB}/scores_latest)')

# Verify by reading back
print('\n  Firestore documents:')
for doc in db.collection('scores_latest').limit(5).stream():
    d = doc.to_dict()
    print(f"  {doc.id:10s}  close={d['close']:>8.2f}  rank={d['composite_rank']}")
```

      Written 50 scores to Firestore (seclab-scores/scores_latest)
    
      Firestore documents:
      ABI.BR      close=   62.76  rank=21
      AD.AS       close=   41.05  rank=4
      ADS.DE      close=  140.25  rank=40
      ADYEN.AS    close=  925.70  rank=48
      AI.PA       close=  168.02  rank=8

## SSH Keys

#### ssh-keygen — generate Ed25519 SSH key pair

```python
# Ed25519 is the modern standard - shorter keys, faster, more secure than RSA.
# The private key stays on your machine. The public key goes to GitHub/GCP.
!ssh-keygen -t ed25519 -C "security-lab-notebook" -f C:/Users/aperi/.ssh/security-lab-key -N ""

os.environ["SSH_KEY_PATH"] = "C:/Users/aperi/.ssh/security-lab-key"
print("  SSH_KEY_PATH set")
```

    Generating public/private ed25519 key pair.
    Your identification has been saved in C:/Users/aperi/.ssh/security-lab-key
    Your public key has been saved in C:/Users/aperi/.ssh/security-lab-key.pub
    The key fingerprint is:
    SHA256:GvPFtczZRvH1CVb4hD2exUfCZBWaimDPUvNLAv/zuG8 security-lab-notebook
    The key's randomart image is:
    +--[ED25519 256]--+
    |             =X*=|
    |            .+=BB|
    |       + o  .o=.B|
    |      . B.++.= + |
    |      o.S*o+= o  |
    |       =..+ ..   |
    |      . .  +     |
    |            +E   |
    |           o+o   |
    +----[SHA256]-----+

#### gcloud compute os-login ssh-keys add — upload public key

```python
# OS Login maps SSH keys to Google accounts - no need to manage
# ~/.ssh/authorized_keys on each VM manually.
!gcloud compute os-login ssh-keys add --key-file=C:/Users/aperi/.ssh/security-lab-key.pub
```

    loginProfile:
      name: '104392677521024249480'
      posixAccounts:
      - accountId: seclab-dev-ap-26
        gid: '1170941192'
        homeDirectory: /home/alexper_recovery_gmail_com
        name: users/alexper.recovery@gmail.com/projects/seclab-dev-ap-26
        operatingSystemType: LINUX
        primary: true
        uid: '1170941192'
        username: alexper_recovery_gmail_com
      sshPublicKeys:
        41e8d21fa528458b27a9352edf522fbdb51276a39ddffa36a36809c9fa84fcbd:
          fingerprint: 41e8d21fa528458b27a9352edf522fbdb51276a39ddffa36a36809c9fa84fcbd
          key: |
            ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGw6+6+miXPgipd67tQz1Fh+2ifTn7OWf4RON73ghnoT security-lab-notebook
          name: users/alexper.recovery@gmail.com/sshPublicKeys/41e8d21fa528458b27a9352edf522fbdb51276a39ddffa36a36809c9fa84fcbd
        8b8b4e64acd580ed6ee82a095a10c7e62adcc0ff276d50e95dad79e36d3b5f5d:
          fingerprint: 8b8b4e64acd580ed6ee82a095a10c7e62adcc0ff276d50e95dad79e36d3b5f5d
          key: ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCXghbq6SX6+AsNe1fu9fCL+PMlQv+w0uZoBZOXt+ba3L7Pz2sJj9WMz0zfCgvHS3ReOS3qsWAK6KVZkvh597A915SCdkxthre/ONT1XutCCd9B09hgxrRE2osZcpQ5o7u8Qi4VZeRWxl4eg3RSaIwNqaISMH71voKFqU9Tl3UaazIU+W2d00ZXyuHSC/1IZwcVIZC91Ph7v7ckF0j2QaaQloK26Nh/FBkpJHdzwky3rFzodgFfuhu+xIpAtlZGPs5dRW63eyEkcuHddgAKcJQl4l/GyVosIuTu2zCeo750y3SA5uRb7AiY/AY7pCZr07wF7/ZMQsDOBInbapyK7cjx
            ELYSIUM\Alex@Elysium
          name: users/alexper.recovery@gmail.com/sshPublicKeys/8b8b4e64acd580ed6ee82a095a10c7e62adcc0ff276d50e95dad79e36d3b5f5d
        a2925aec6ea32bf3d7fa4da71844ae5814c3281b38686a36d754c185fa76d004:
          fingerprint: a2925aec6ea32bf3d7fa4da71844ae5814c3281b38686a36d754c185fa76d004
          key: |
            ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEVzy9nMKjGvl5dhbYUj0X6gCEhTk4gQ89bC5htVOrxq security-lab-notebook
          name: users/alexper.recovery@gmail.com/sshPublicKeys/a2925aec6ea32bf3d7fa4da71844ae5814c3281b38686a36d754c185fa76d004

## Artifact Registry

#### gcloud artifacts repositories create — Docker repository

```python
# Artifact Registry is GCP's managed container registry (replaces Container Registry).
# Used for storing Docker images, signing them, and scanning for vulnerabilities.
!gcloud artifacts repositories create notebook-docker --repository-format=docker --location=europe-west1 --description="Security lab Docker images"
```

    Create request issued for: [notebook-docker]
    Waiting for operation [projects/seclab-dev-ap-26/locations/europe-west1/operations/56bd88b7-a93d-41d4-ad30-8a683eec6c37] to complete...
    ...........................................................................................................................................done.
    Created repository [notebook-docker].

#### gcloud auth configure-docker — Artifact Registry authentication

```python
# Tells Docker to use gcloud credentials when pushing/pulling from this registry.
!gcloud auth configure-docker europe-west1-docker.pkg.dev
```

    WARNING: Your config file at [C:\Users\aperi\.docker\config.json] contains these credential helper entries:
    
    {
      "credHelpers": {
        "europe-west1-docker.pkg.dev": "gcloud"
      }
    }
    Adding credentials for: europe-west1-docker.pkg.dev
    gcloud credential helpers already registered correctly.

## Workload Identity Federation

#### gcloud iam workload-identity-pools create — identity pool

```python
# A workload identity pool is a container for external identity providers.
# GitHub Actions tokens will be mapped into this pool.
!gcloud iam workload-identity-pools create github-pool --location=global --display-name="GitHub Actions Pool"
```

    Created workload identity pool [github-pool].

#### gcloud iam workload-identity-pools providers create-oidc — GitHub Actions

```python
# Maps GitHub's OIDC tokens to Google Cloud identities.
# The attribute-condition restricts access to repos owned by your GitHub account.
!gcloud iam workload-identity-pools providers create-oidc github-provider --location=global --workload-identity-pool=github-pool --issuer-uri="https://token.actions.githubusercontent.com" --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" --attribute-condition="assertion.repository_owner=='alp78'"
```

    Created workload identity pool provider [github-provider].

#### Get project number

```python
# The project number (not ID) is needed for the workload identity binding.
!gcloud projects describe seclab-dev-ap-26 --format="value(projectNumber)"
```

    922174528852

#### Bind service account to workload identity

```python
# Allows the GitHub Actions workflow to impersonate the service account.
# Fetches the project number automatically (no manual copy-paste needed).
PROJECT_NUMBER = subprocess.check_output(
    'gcloud projects describe seclab-dev-ap-26 --format=value(projectNumber)',
    shell=True, text=True
).strip()
print(f'  Project number: {PROJECT_NUMBER}')
!gcloud iam service-accounts add-iam-policy-binding notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com --role="roles/iam.workloadIdentityUser" --member="principalSet://iam.googleapis.com/projects/{PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/alp78/security-lab"
```

      Project number: 922174528852
    bindings:
    - members:
      - principalSet://iam.googleapis.com/projects/922174528852/locations/global/workloadIdentityPools/github-pool/attribute.repository/alp78/security-lab
      role: roles/iam.workloadIdentityUser
    etag: BwZN48VF8RM=
    version: 1

    Updated IAM policy for serviceAccount [notebook-sa@seclab-dev-ap-26.iam.gserviceaccount.com].

## Verify Setup

#### gcloud secrets list — verify Secret Manager

```python
# Verify all secrets were created.
!gcloud secrets list
```

    NAME          CREATED              REPLICATION_POLICY  LOCATIONS
    db-config     2026-03-25T22:10:29  automatic           -
    db-password   2026-03-25T22:10:26  automatic           -
    test-api-key  2026-03-25T22:10:22  automatic           -

#### gcloud kms keys list — verify Cloud KMS

```python
# Verify the encryption key exists in the key ring.
!gcloud kms keys list --location=europe-west1 --keyring=notebook-keyring
```

    NAME                                                                                                        PURPOSE          ALGORITHM                    PROTECTION_LEVEL  LABELS  PRIMARY_ID  PRIMARY_STATE
    projects/seclab-dev-ap-26/locations/europe-west1/keyRings/notebook-keyring/cryptoKeys/notebook-encrypt-key  ENCRYPT_DECRYPT  GOOGLE_SYMMETRIC_ENCRYPTION  SOFTWARE                  1           ENABLED

#### gcloud compute instances list — verify Compute Engine

```python
# Verify the VM was created and is running.
!gcloud compute instances list
```

    NAME         ZONE            MACHINE_TYPE  PREEMPTIBLE  INTERNAL_IP  EXTERNAL_IP    STATUS
    notebook-vm  europe-west1-b  e2-micro                   10.132.0.2   34.76.141.248  RUNNING

#### gcloud storage ls — verify GCS bucket contents

```python
# Verify the bucket exists (will be empty).
!gcloud storage ls gs://seclab-dev-ap-26-data
```

    gs://seclab-dev-ap-26-data/bronze/

#### gcloud sql instances list — verify Cloud SQL

```python
# Verify the SQL Server instance is running.
!gcloud sql instances list
```

    NAME          DATABASE_VERSION        LOCATION        TIER              PRIMARY_ADDRESS  PRIVATE_ADDRESS  STATUS
    notebook-sql  SQLSERVER_2022_EXPRESS  europe-west1-b  db-custom-1-3840  35.189.244.119   -                RUNNABLE

#### bq ls — verify BigQuery datasets

```python
# Verify BigQuery access (will be empty initially).
!bq ls --project_id=seclab-dev-ap-26
```

      datasetId   
     ------------ 
      index_data

#### gcloud firestore databases list — verify Firestore

```python
# Verify the seclab-scores database was created.
!gcloud firestore databases list --project=seclab-dev-ap-26
```

    ---
    appEngineIntegrationMode: DISABLED
    concurrencyMode: PESSIMISTIC
    createTime: '2026-03-25T22:36:33.309401Z'
    databaseEdition: STANDARD
    deleteProtectionState: DELETE_PROTECTION_DISABLED
    earliestVersionTime: '2026-03-25T22:36:33.309401Z'
    etag: IIqKlMaOvJMDMNnNg7iOvJMD
    freeTier: true
    locationId: europe-west1
    name: projects/seclab-dev-ap-26/databases/seclab-scores
    pointInTimeRecoveryEnablement: POINT_IN_TIME_RECOVERY_DISABLED
    realtimeUpdatesMode: REALTIME_UPDATES_MODE_ENABLED
    type: FIRESTORE_NATIVE
    uid: 7c0b0e92-a6f3-41b8-995b-c370f9b0a101
    updateTime: '2026-03-25T22:36:33.309401Z'
    versionRetentionPeriod: 3600s

#### gcloud artifacts repositories list — verify Artifact Registry

```python
# Verify the Docker repository was created.
!gcloud artifacts repositories list --location=europe-west1
```

                                                                               ARTIFACT_REGISTRY
    REPOSITORY       FORMAT  MODE                 DESCRIPTION                 LOCATION      LABELS  ENCRYPTION          CREATE_TIME          UPDATE_TIME          SIZE (MB)
    notebook-docker  DOCKER  STANDARD_REPOSITORY  Security lab Docker images  europe-west1          Google-managed key  2026-03-25T23:21:23  2026-03-25T23:21:23  0

    Listing items under project seclab-dev-ap-26, location europe-west1.

#### gcloud iam workload-identity-pools list — verify WIF

```python
# Verify the identity pool and provider exist.
!gcloud iam workload-identity-pools list --location=global
```

    ---
    displayName: GitHub Actions Pool
    name: projects/922174528852/locations/global/workloadIdentityPools/github-pool
    state: ACTIVE
