---
tags: [security, infrastructure, terraform, airflow, gcp, github-actions, iam]
type: reference
technology: [gcp, terraform, airflow, github-actions]
status: stable
updated: 2026-03-23
---

# Secrets Management

> [!abstract] When You Need This
> Every data pipeline needs credentials: database passwords, API keys, service account keys, vendor tokens. This note covers how to store, access, rotate, and audit secrets across the entire stack.

## GCP Secret Manager

### Create and Version a Secret

```bash
# Create a secret
gcloud secrets create db-password \
  --replication-policy="automatic" \
  --labels="team=data-platform,env=prod"

# Add a version (the actual secret value)
echo -n "MyS3cur3P@ssw0rd" | gcloud secrets versions add db-password --data-file=-

# Access the latest version
gcloud secrets versions access latest --secret=db-password

# List versions
gcloud secrets versions list db-password
```

### IAM for Secrets

```bash
# Grant a service account access to read a specific secret
gcloud secrets add-iam-policy-binding db-password \
  --member="serviceAccount:sa-pipeline@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Principle of least privilege: grant per-secret, not project-wide
```

### Terraform Provisioning

The Terraform blocks below are part of the broader [terraform-iam-and-secrets](/07-Terraform/GCP-Resources/terraform-iam-and-secrets) module that provisions both IAM bindings and Secret Manager resources together.

```hcl
resource "google_secret_manager_secret" "db_password" {
  secret_id = "db-password"
  replication { auto {} }
  labels = { team = "data-platform", env = var.environment }
}

resource "google_secret_manager_secret_version" "db_password_v1" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = var.db_password  # Passed via TF_VAR, never hardcoded
}

resource "google_secret_manager_secret_iam_member" "pipeline_access" {
  secret_id = google_secret_manager_secret.db_password.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.pipeline.email}"
}
```

### Access from Python

The Python client library usage here is covered in more depth in [20_py_security_setup](/02-Programming-Languages/Python/20_py_security_setup), which includes error handling and caching patterns.

```python
from google.cloud import secretmanager

def get_secret(secret_id: str, project_id: str, version: str = "latest") -> str:
    client = secretmanager.SecretManagerServiceClient()
    name = f"projects/{project_id}/secrets/{secret_id}/versions/{version}"
    response = client.access_secret_version(request={"name": name})
    return response.payload.data.decode("UTF-8")

# Usage
db_password = get_secret("db-password", "data-platform-prod")
```

## Airflow Integration

### Airflow Connections Backed by Secret Manager

Airflow can resolve connections and variables directly from Secret Manager — no secrets stored in the metadata database or environment variables.

> [!info] Configuration
> Set these environment variables in `airflow.cfg` or `docker-compose.yml`:
> - `AIRFLOW__SECRETS__BACKEND` = `airflow.providers.google.cloud.secrets.secret_manager.CloudSecretManagerBackend`
> - `AIRFLOW__SECRETS__BACKEND_KWARGS` = `{"project_id": "data-platform-prod", "connections_prefix": "airflow-conn", "variables_prefix": "airflow-var"}`

Then create secrets in Secret Manager with the matching prefix:
- `airflow-conn-sql-server` → connection URI
- `airflow-var-calc-date` → variable value

Airflow automatically resolves these when you reference `Variable.get("calc-date")` or `BaseHook.get_connection("sql-server")` — no code changes needed.

## GitHub Actions

### GitHub Actions — Workload Identity Federation (Keyless)

```yaml
# No service account key needed
- uses: google-github-actions/auth@v2
  with:
    workload_identity_provider: projects/123/locations/global/workloadIdentityPools/github/providers/github
    service_account: sa-ci@PROJECT_ID.iam.gserviceaccount.com
```

### GitHub Actions — Repository Secrets

Store in GitHub Settings > Secrets and variables > Actions:
- `WIF_PROVIDER` — Workload Identity provider resource name
- `SA_EMAIL` — Service account email
- Never store GCP service account JSON keys as GitHub secrets — use WIF instead

### Local Development Secret Patterns

For local development, secrets often surface as [environment-variables](/01-Shell/Scripting/environment-variables) in the shell. The `direnv` pattern below bridges Secret Manager with shell-level credential handling.

```bash
# Application Default Credentials (no key file needed)
gcloud auth application-default login

# For service-specific testing
gcloud auth application-default login --scopes=https://www.googleapis.com/auth/bigquery

# direnv for project-specific env vars
# .envrc (git-ignored)
export PROJECT_ID=data-platform-dev
export SQL_CONN_STRING="Server=localhost;Database=analytics_db;User=sa;Password=$(gcloud secrets versions access latest --secret=db-password-dev)"
```

## Secret Rotation Procedure

### Service Account Keys

1. Create new key: `gcloud iam service-accounts keys create new-key.json --iam-account=SA_EMAIL`
2. Upload new key to Secret Manager as new version
3. Update all consumers to use new version (Airflow, Cloud Run, etc.)
4. Verify consumers work with new key
5. Disable old key: `gcloud iam service-accounts keys disable OLD_KEY_ID --iam-account=SA_EMAIL`
6. Wait 24 hours, then delete: `gcloud iam service-accounts keys delete OLD_KEY_ID --iam-account=SA_EMAIL`
7. Delete local key file: `rm new-key.json`

> [!warning] Prefer Workload Identity
>
> Service account keys are a liability. Use Workload Identity Federation (GitHub Actions), attached service accounts (Compute Engine, Cloud Run), or Application Default Credentials wherever possible. Keys should be the last resort.

### Database Passwords

1. Generate new password (min 20 chars, mixed case, numbers, symbols)
2. Update in Secret Manager as new version
3. Update SQL Server: `ALTER LOGIN sa WITH PASSWORD = 'new_password'`
4. Restart dependent services (Cloud Run jobs, Airflow connections)
5. Verify connectivity
6. Disable old Secret Manager version

### Secret Management Anti-Patterns

| Anti-Pattern | Risk | Better Approach |
|-------------|------|----------------|
| Secrets in source code | Exposed in Git history forever | Secret Manager + IAM |
| Secrets in plain env vars | Visible in process listing, logs | Secret Manager + runtime fetch |
| Shared service account keys | No accountability, hard to rotate | Per-service SAs with WIF |
| Never rotating secrets | Increased exposure window | Quarterly rotation schedule |
| Wide secret access | Any SA can read any secret | Per-secret IAM bindings |
| Key files on developer laptops | Lost/stolen laptops expose secrets | ADC + gcloud auth |

## Related

- [[gcp-identity-and-connection-patterns]] — Identity model and connection patterns that determine how secrets are consumed
- [[service-accounts-and-iam]] — IAM roles and service account design
- [tf-iam-secrets-serverless](/07-Terraform/Block-Library/tf-iam-secrets-serverless) — Terraform blocks for secrets and IAM
- [github-actions-data-engineering](/10-GitHub-Actions/github-actions-data-engineering) — Workload Identity Federation setup
- [airflow-deployment](/12-Orchestration/Airflow/airflow-deployment) — Airflow configuration and connections
- [golden-rules-of-data-engineering](/14-Data-Architecture/Decision-Frameworks/golden-rules-of-data-engineering) — Rule 9: Automate Everything
- [environment-management-strategy](/14-Data-Architecture/Pipeline-Patterns/environment-management-strategy) — How secrets differ between dev, staging, and prod
