---
tags: [infrastructure, terraform, iac]
type: reference
technology: terraform
status: stable
updated: 2026-03-23
description: "Comprehensive catalog of Terraform production problems — 25 issues ranked by severity with root cause analysis, impact assessment, prevention protocols, and fix procedures for data engineering teams on GCP."
---

# Terraform Production Problems

Terraform is the foundation of infrastructure-as-code for the data platform, but its state-based model introduces a class of problems that can destroy production infrastructure in seconds. In a regulated financial index platform where every GCP resource supports the publication pipeline, a mismanaged `terraform apply` can take down the entire data platform — the SQL Server VM that runs index calculations, the GCS buckets holding vendor data feeds, the BigQuery datasets powering analytics. This note catalogs every major problem encountered in production, explains why it happens technically, and provides actionable prevention and recovery procedures. Problems are ordered by severity: Critical (infrastructure destruction/data loss) → High (drift/team blocking) → Moderate (operational pain) → Low (team friction).

---

## Critical — Infrastructure Destruction / Data Loss

---

### Accidental `terraform destroy` on Production

**What happens**

An engineer working late on a cost reduction task opens a terminal, switches to the project directory, and types `terraform destroy` — but they are in the `prod` workspace, not `dev`. Or, worse: muscle memory types `destroy` instead of `apply` after reviewing a plan. Within minutes, Terraform deletes the SQL Server VM (the index calculation engine), the Airflow VM (the orchestration layer), GCS buckets containing vendor data feeds, BigQuery datasets, Pub/Sub topics, and all firewall rules. The GCP project still exists but the data platform is gone.

**Root cause**

`terraform destroy` is a first-class Terraform command that generates a plan to delete every resource tracked in the current workspace's state file. It has no built-in production safeguard — it asks for one `yes` confirmation and then executes. Workspace isolation does not prevent this; it determines *which* state gets destroyed. If the engineer is in the prod workspace, the prod state gets destroyed.

**Consequences**

- SQL Server VM deleted: index calculation engine offline, no index publication possible — EU BMR violation if publication window is missed
- Airflow VM deleted: all scheduled DAGs stop; vendor data ingestion halts; data gaps accumulate in BigQuery
- GCS buckets deleted (if not protected): vendor data files gone — irreversible data loss if bucket versioning was not enabled
- BigQuery datasets deleted: analytical history gone unless backups exist
- Pub/Sub topics deleted: downstream consumers disconnect silently; real-time data pipeline broken
- IAM bindings and firewall rules destroyed: even rebuilt VMs cannot communicate until rules are re-applied
- Audit trail: every deletion generates Cloud Audit Logs, which is good for forensics but does not restore data
- Recovery time: 2–8 hours to rebuild infrastructure; data loss may be permanent

**Prevention protocol**

1. Remove `terraform destroy` from CI/CD entirely — the pipeline should never have a destroy stage for prod:

```yaml
# .github/workflows/terraform-apply.yml
# Do NOT add a destroy job. Explicitly document this:
# DESTROY IS NOT AUTOMATED. Manual destruction requires break-glass procedure.
```

2. Enable `deletion_protection` on all critical GCP compute resources:

```hcl
# compute.tf
resource "google_compute_instance" "sql_server" {
  name         = "sql-server-prod"
  machine_type = "n2-standard-8"
  zone         = "europe-west3-b"

  deletion_protection = true  # GCP will REFUSE to delete this VM via API or Terraform

  boot_disk {
    initialize_params {
      image = "windows-cloud/windows-2022"
      size  = 200
    }
  }
  # ...
}

resource "google_compute_instance" "airflow" {
  name                = "airflow-prod"
  machine_type        = "e2-standard-4"
  zone                = "europe-west3-b"
  deletion_protection = true
  # ...
}
```

3. Enable `prevent_destroy` lifecycle on GCS buckets and BigQuery datasets:

```hcl
# storage.tf
resource "google_storage_bucket" "vendor_data_landing" {
  name     = "vendor-data-landing-prod"
  location = "EU"

  versioning {
    enabled = true
  }

  lifecycle {
    prevent_destroy = true  # Terraform will error before planning a destroy
  }
}

resource "google_bigquery_dataset" "analytics" {
  dataset_id = "analytics_prod"
  location   = "EU"

  delete_contents_on_destroy = false  # Prevents accidental data deletion

  lifecycle {
    prevent_destroy = true
  }
}
```

4. Enable `deletionProtection` on Cloud SQL instances:

```hcl
resource "google_sql_database_instance" "main" {
  name             = "sql-prod"
  database_version = "SQLSERVER_2019_STANDARD"
  region           = "europe-west3"

  deletion_protection = true  # Cloud SQL-specific, separate from compute deletion_protection
  # ...
}
```

5. Block destroy in GitHub Actions by scanning plan output:

```yaml
# .github/workflows/terraform-plan.yml
- name: Check for destroys on protected resources
  run: |
    PLAN_OUTPUT=$(terraform show -json plan.tfplan)
    DESTROYS=$(echo "$PLAN_OUTPUT" | jq '[.resource_changes[] | select(.change.actions[] == "delete")] | length')
    if [ "$DESTROYS" -gt "0" ]; then
      echo "ERROR: Plan contains $DESTROYS resource deletions."
      echo "Destroys require manual break-glass procedure. Blocking automated apply."
      echo "$PLAN_OUTPUT" | jq '[.resource_changes[] | select(.change.actions[] == "delete") | .address]'
      exit 1
    fi
```

6. Use workspace naming that makes prod unmistakable — and confirm at apply time:

```bash
# In CI, assert the workspace before applying
WORKSPACE=$(terraform workspace show)
if [ "$WORKSPACE" = "prod" ]; then
  echo "Applying to PRODUCTION. Requires PROD_APPLY_APPROVAL=true environment variable."
  if [ "$PROD_APPLY_APPROVAL" != "true" ]; then
    exit 1
  fi
fi
```

**Fix procedure**

> [!danger] Deleted Data Is Unrecoverable
>
> If `deletion_protection` was NOT enabled and resources are gone, data on deleted Persistent Disks is permanently unrecoverable without snapshots.

1. Confirm what was destroyed via Cloud Audit Logs:

```bash
gcloud logging read \
  'protoPayload.methodName="v1.compute.instances.delete" OR protoPayload.methodName="storage.buckets.delete"' \
  --freshness=1h \
  --format=json \
  --project=your-project-id
```

2. Restore disk data from the most recent snapshot:

```bash
# List available snapshots
gcloud compute snapshots list --filter="sourceDisk:sql-server-prod" --sort-by=~creationTimestamp

# Create a new disk from the latest snapshot
gcloud compute disks create sql-server-prod-restored \
  --source-snapshot=sql-server-prod-snapshot-20260322 \
  --zone=europe-west3-b
```

3. Restore GCS bucket data from backup bucket or versioning:

```bash
# If the bucket itself is gone, recreate it and restore from a backup bucket
gsutil mb -l EU gs://vendor-data-landing-prod
gsutil -m cp -r gs://vendor-data-landing-prod-backup/** gs://vendor-data-landing-prod/
```

4. Re-run Terraform to rebuild all infrastructure:

```bash
# In the prod workspace
terraform workspace select prod
terraform init
terraform apply -auto-approve  # Only after verifying plan shows only creates
```

5. Verify all resources are healthy before resuming publication:

```bash
gcloud compute instances describe sql-server-prod --zone=europe-west3-b --format="value(status)"
gcloud compute instances describe airflow-prod --zone=europe-west3-b --format="value(status)"
```

---

### State File Corruption

**What happens**

An engineer runs `terraform apply` in CI. The GitHub Actions runner is killed mid-apply (job timeout, runner eviction, or an engineer cancels the workflow). The apply was halfway through: 3 resources created, 2 more in progress. The state file was partially updated. The next `terraform plan` shows Terraform wanting to create resources that already exist in GCP, and destroy resources that are live and serving traffic. The state no longer reflects reality.

**Root cause**

Terraform writes state in a single atomic operation at the end of `apply`. If the process is killed before the final write, the state on disk (or in GCS) reflects the world *before* the apply, not after. Resources created during the interrupted apply are now "orphaned" — they exist in GCP but not in state. Terraform has no awareness of them and plans to create duplicates, or in worst cases, the partial state has inconsistent references that cause cascading plan errors.

**Consequences**

- Terraform plans become unreliable — every plan needs manual verification against GCP Console
- Attempting to apply a corrupted plan can create duplicate resources (two Pub/Sub topics, duplicate firewall rules)
- State lock may remain active (Terraform writes a lock object in GCS) — blocking all team members
- Orphaned GCS buckets may incur ongoing storage costs
- Index publication pipeline may have partial infrastructure — some Cloud Run jobs created, others missing

**Prevention protocol**

1. Use GCS remote backend with locking enabled (this is default for GCS backend):

```hcl
# backend.tf
terraform {
  backend "gcs" {
    bucket = "tf-state-prod-bucket"
    prefix = "terraform/state"
    # Locking is automatic with GCS backend — no extra config needed
  }
}
```

2. Enable versioning on the state bucket so every state write is preserved:

```bash
# One-time setup
gcloud storage buckets update gs://tf-state-prod-bucket --versioning

# Verify
gcloud storage buckets describe gs://tf-state-prod-bucket --format="value(versioning)"
```

3. In GitHub Actions, never cancel a running apply — add a warning to the workflow:

```yaml
# .github/workflows/terraform-apply.yml
- name: Terraform Apply
  run: terraform apply -input=false plan.tfplan
  timeout-minutes: 30
  # WARNING: Do not cancel this step. If it times out, investigate state
  # before re-running. Check: gcloud storage ls --all-versions gs://tf-state-prod-bucket/terraform/state/
```

4. Add a pre-apply state backup step:

```yaml
- name: Backup state before apply
  run: |
    terraform state pull > state-backup-$(date +%Y%m%d-%H%M%S).tfstate
    gsutil cp state-backup-*.tfstate gs://tf-state-backups-prod/
```

**Fix procedure**

1. Check all state versions in the GCS bucket:

```bash
gcloud storage ls --all-versions gs://tf-state-prod-bucket/terraform/state/default.tfstate
# Output shows generation numbers and timestamps:
# gs://tf-state-prod-bucket/terraform/state/default.tfstate#1711234567890123
# gs://tf-state-prod-bucket/terraform/state/default.tfstate#1711234500000000
```

2. Identify the last known-good state (the version before the interrupted apply):

```bash
# Download and inspect each version
gcloud storage cp "gs://tf-state-prod-bucket/terraform/state/default.tfstate#1711234500000000" ./state-good.tfstate
cat state-good.tfstate | jq '.serial, .resources | length'
```

3. If the lock is still active, verify the locking process is dead, then force-unlock:

```bash
# Check lock info
terraform force-unlock --help  # Note the lock ID from the error message
# Verify the CI job that held the lock is actually terminated in GitHub Actions UI
# Only then:
terraform force-unlock LOCK-ID-FROM-ERROR
```

4. Restore the good state:

```bash
# Pull current (corrupted) state for inspection
terraform state pull > corrupted-state-backup.tfstate

# Push the known-good state
terraform state push state-good.tfstate

# Verify the restored state
terraform plan  # Should show only the resources created during the interrupted apply
```

5. Clean up orphaned resources that were created but not in the restored state:

```bash
# Import orphaned resources into state
terraform import google_storage_bucket.vendor_data_landing vendor-data-landing-prod
terraform import google_pubsub_topic.index_events projects/your-project/topics/index-events

# Then run apply to reconcile
terraform apply
```

---

### Apply Destroys Unexpected Resource (Rename = Destroy + Create)

**What happens**

A teammate renames a Terraform resource block: `google_compute_instance.sql_vm` becomes `google_compute_instance.sql_server_prod` for clarity. They run `terraform plan`, skim the output, see "1 to add, 1 to destroy" — assume it's some minor firewall rule — and apply. Terraform destroys the SQL Server VM (the index calculation engine) and creates a new one. The new VM has no data: the boot disk is fresh. The SQL Server databases, indexes, and configurations are gone. Index publication stops.

**Root cause**

Terraform tracks resources by their *address* in state (e.g., `google_compute_instance.sql_vm`). A rename changes the address. Terraform cannot distinguish a rename from delete-old + create-new. It plans to destroy the resource at the old address and create a new resource at the new address. The `moved` block (introduced in Terraform 1.1) was created specifically to solve this, but teams frequently forget to use it.

**Consequences**

- SQL Server VM destroyed and recreated: all data on boot disk lost unless snapshot exists
- Downtime during destruction and recreation (10–30 minutes minimum)
- New VM has default configuration — SQL Server not yet configured, databases not yet attached
- Persistent disks may survive if `keep_on_destroy = false` is not set, but they are detached
- EU BMR audit trail shows infrastructure destruction event — requires incident report

**Prevention protocol**

1. Always use `moved` blocks when renaming resources:

```hcl
# moved.tf (or inline in the relevant .tf file)
moved {
  from = google_compute_instance.sql_vm
  to   = google_compute_instance.sql_server_prod
}
```

After applying, the moved block can be removed. Terraform will update the state address without destroying the resource.

2. Enable `prevent_destroy` on the VM and set explicit `lifecycle`:

```hcl
resource "google_compute_instance" "sql_server_prod" {
  name = "sql-server-prod"
  # ...

  lifecycle {
    prevent_destroy = true
    # Also ignore changes to metadata — prevents spurious diffs
    ignore_changes = [metadata, labels]
  }
}
```

3. In CI, parse the plan JSON and block any destroy of named protected resources:

```bash
#!/bin/bash
# scripts/check-plan.sh
PLAN_JSON=$(terraform show -json plan.tfplan)
PROTECTED_RESOURCES=(
  "google_compute_instance.sql_server_prod"
  "google_compute_instance.airflow"
  "google_sql_database_instance.main"
  "google_storage_bucket.vendor_data_landing"
  "google_bigquery_dataset.analytics"
)

for RESOURCE in "${PROTECTED_RESOURCES[@]}"; do
  ACTION=$(echo "$PLAN_JSON" | jq -r \
    --arg addr "$RESOURCE" \
    '.resource_changes[] | select(.address == $addr) | .change.actions[]' 2>/dev/null)
  if echo "$ACTION" | grep -q "delete"; then
    echo "BLOCKED: Plan destroys protected resource: $RESOURCE"
    echo "If this is a rename, add a 'moved' block. If intentional, use break-glass procedure."
    exit 1
  fi
done
echo "Plan check passed: no protected resources destroyed."
```

```yaml
# .github/workflows/terraform-plan.yml
- name: Check plan for protected resource destruction
  run: bash scripts/check-plan.sh
```

**Fix procedure**

> [!danger] Boot Disk Data May Be Lost
>
> If the VM was destroyed and `deletion_protection` was NOT enabled, the boot disk data is gone unless a snapshot existed. Check snapshots immediately.

1. Check for existing disk snapshots:

```bash
gcloud compute snapshots list \
  --filter="sourceDisk~sql-server" \
  --sort-by=~creationTimestamp \
  --limit=5
```

2. If snapshot exists, create a new disk from it and attach to the new VM:

```bash
gcloud compute disks create sql-server-boot-restored \
  --source-snapshot=sql-server-snapshot-20260322 \
  --zone=europe-west3-b \
  --type=pd-ssd

# Modify the Terraform config to use the restored disk (data disk, not boot)
```

3. If the resource was destroyed but the plan was wrong (e.g., resource still exists in GCP due to `deletion_protection`), import it:

```bash
# The VM still exists in GCP (deletion_protection blocked it), but state thinks it's gone
terraform import google_compute_instance.sql_server_prod \
  projects/your-project/zones/europe-west3-b/instances/sql-server-prod
```

4. Add the `moved` block to properly rename without recreating:

```hcl
moved {
  from = google_compute_instance.sql_vm
  to   = google_compute_instance.sql_server_prod
}
```

5. Re-run `terraform plan` — should show 0 changes if the import was successful.

---

### Secrets in Plain Text in State

**What happens**

A Terraform config creates a Cloud SQL instance and sets the root password as a Terraform variable. The password is stored as plain text in the state file in GCS. A new team member with `storage.objects.get` on the state bucket runs `terraform state pull` to debug an issue and sees every database password, API key, and service account key in plain text JSON. Separately, a CI pipeline that runs `terraform plan` prints the database password in the diff output, which is visible in the GitHub Actions logs — accessible to anyone with repository access.

**Root cause**

Terraform state is a JSON file. All resource attributes — including sensitive ones — are stored as plain text unless the provider implements sensitive handling. Even variables marked `sensitive = true` are stored unredacted in state (the sensitivity marking only affects plan output display). GCS server-side encryption encrypts the file at rest, but anyone with GCS read permissions sees the plaintext after decryption.

**Consequences**

- Database passwords visible to all team members with GCS bucket access
- CI log retention means passwords are archived in GitHub Actions logs
- SA keys in state are fully functional credentials that could be extracted
- In a regulated financial environment, exposure of infrastructure credentials requires incident reporting and credential rotation
- GDPR/EU BMR compliance risk if secrets relate to client data access

**Prevention protocol**

1. Mark all sensitive variables and outputs:

```hcl
# variables.tf
variable "db_password" {
  type      = string
  sensitive = true  # Redacted in plan output; still in state, but at least not visible in logs
}

variable "api_key" {
  type      = string
  sensitive = true
}

# outputs.tf
output "connection_string" {
  value     = "Server=${google_compute_instance.sql_server_prod.network_interface[0].network_ip}"
  sensitive = false  # Not sensitive itself
}

output "db_endpoint" {
  value     = google_sql_database_instance.main.connection_name
  sensitive = false
}
# NEVER output the actual password
```

2. The canonical pattern: Terraform creates the Secret Manager secret resource, but the SECRET VALUE is set outside Terraform (via gcloud or application bootstrap):

```hcl
# secrets.tf — Terraform manages the SECRET CONTAINER, not the value
resource "google_secret_manager_secret" "db_password" {
  secret_id = "sql-server-db-password"
  project   = var.project_id

  replication {
    auto {}
  }

  labels = {
    managed-by  = "terraform"
    environment = var.environment
  }
}

# Output the secret name for use by applications — NOT the value
output "db_password_secret_name" {
  value = google_secret_manager_secret.db_password.name
}
```

```bash
# Set the secret value via gcloud — this value is NEVER in Terraform state
echo -n "your-secure-password" | gcloud secrets versions add sql-server-db-password --data-file=-
```

3. Applications reference secrets via Secret Manager, not Terraform outputs:

```hcl
# Cloud Run job references the secret — value never flows through Terraform state
resource "google_cloud_run_v2_job" "data_ingestion" {
  name     = "data-ingestion-job"
  location = var.region

  template {
    template {
      containers {
        image = "europe-west3-docker.pkg.dev/${var.project_id}/data-platform/ingestion:latest"

        env {
          name = "DB_PASSWORD"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.db_password.secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }
}
```

4. Enable CMEK on the state bucket for an additional layer of protection:

```hcl
resource "google_storage_bucket" "tf_state" {
  name     = "tf-state-prod-bucket"
  location = "EU"

  versioning {
    enabled = true
  }

  encryption {
    default_kms_key_name = google_kms_crypto_key.tf_state_key.id
  }

  lifecycle {
    prevent_destroy = true
  }
}
```

5. Restrict state bucket IAM — only CI service account and senior engineers:

```hcl
resource "google_storage_bucket_iam_binding" "tf_state_readers" {
  bucket = google_storage_bucket.tf_state.name
  role   = "roles/storage.objectViewer"

  members = [
    "serviceAccount:terraform-ci@your-project.iam.gserviceaccount.com",
    "user:senior-engineer@company.com",
  ]
  # Do NOT give all engineers objectViewer on the state bucket
}
```

6. Mask sensitive values in GitHub Actions CI logs:

```yaml
- name: Terraform Plan
  run: |
    terraform plan -out=plan.tfplan 2>&1 | \
      sed 's/password = .*/password = [REDACTED]/gi' | \
      sed 's/api_key = .*/api_key = [REDACTED]/gi'
  env:
    TF_VAR_db_password: ${{ secrets.DB_PASSWORD }}
```

**Fix procedure**

1. If secrets are already in state, rotate all exposed credentials immediately:

```bash
# Rotate the database password
gcloud secrets versions add sql-server-db-password --data-file=- <<< "$(openssl rand -base64 32)"

# Update the actual SQL Server password (via VM connection or SQL command)
# Then update the secret version
```

2. Remove the secret value from state by migrating to the Secret Manager pattern above, then running:

```bash
# Remove the resource that stores the secret value from state
terraform state rm google_sql_database_instance.main
# Reimport without the password attribute (only works if provider supports it)
terraform import google_sql_database_instance.main projects/your-project/instances/sql-prod
```

3. Audit all state versions for exposed secrets:

```bash
gcloud storage ls --all-versions gs://tf-state-prod-bucket/terraform/state/
# Review each version, then permanently delete old versions that contained secrets
gcloud storage rm "gs://tf-state-prod-bucket/terraform/state/default.tfstate#OLD_GENERATION"
```

---

### `force-unlock` While Another Apply Runs

**What happens**

Engineer A triggers a `terraform apply` via GitHub Actions — it's a large apply (Cloud NAT, new Cloud Run services, firewall rules) that takes 12 minutes. Engineer B needs to apply an urgent hotfix for a firewall rule blocking the vendor data feed. They try `terraform apply` locally and get: `Error: Error locking state: Error acquiring the state lock`. Frustrated, Engineer B runs `terraform force-unlock LOCK-ID` without verifying that Engineer A's apply is still running. Engineer A's apply continues writing state to the now-unlocked backend. Both writes complete. State is corrupted.

**Root cause**

GCS backend implements state locking via a lock object in the bucket. `force-unlock` deletes this lock object regardless of whether the holder is still running. Terraform has no distributed lock safety — once the lock is deleted, any concurrent process can acquire it and write state. If two applies complete concurrently, the last write wins, and the "winning" state may not include changes from the other apply.

**Consequences**

- State reflects only one apply's changes — the other apply's infrastructure changes are orphaned
- Resources created by the "lost" apply exist in GCP but not in state — Terraform plans to create them again on the next run (duplicates), or they're simply invisible
- Next plan may show phantom destroys of resources that didn't exist in the "winning" state
- In a financial platform, a misapplied IAM binding or missing firewall rule can block the entire data pipeline

**Prevention protocol**

1. Before ever running `force-unlock`, verify the lock holder is actually dead:

```bash
# Step 1: Get the lock info from the error message or directly
terraform force-unlock --help  # Shows the lock ID format

# Step 2: Check if the locking process is still alive
# Look at the lock info in GCS
gcloud storage cat gs://tf-state-prod-bucket/terraform/state/default.tfstate.tflock 2>/dev/null || \
  gsutil cat gs://tf-state-prod-bucket/terraform/state/.terraform.tfstate.lock.info

# Output shows: {"ID":"...","Operation":"OperationTypeApply","Created":"2026-03-23T10:00:00Z","Info":"..."}
```

2. Cross-reference the lock creation time with CI/CD pipeline runs:

```bash
# Check GitHub Actions — is there an active workflow run from around the lock creation time?
gh run list --workflow=terraform-apply.yml --status=in_progress
# If a run is IN PROGRESS, DO NOT force-unlock. Wait for it to complete.
```

3. Only force-unlock if the process is confirmed dead:

```bash
# The process is confirmed dead (job cancelled, runner crashed). Now safe to unlock.
LOCK_ID="your-lock-id-from-error-message"
terraform force-unlock "$LOCK_ID"

# Verify lock is gone
terraform plan  # Should not show a lock error
```

4. Enforce CI/CD-only applies for production — no local applies:

```yaml
# .github/workflows/terraform-apply.yml
# This is the ONLY path to apply in production.
# Engineers may NOT run 'terraform apply' locally against prod state.
# If this workflow is running, wait. Do not force-unlock.
```

**Fix procedure**

1. If force-unlock was run while another apply was in progress and state is now corrupted, immediately run `terraform plan` and compare to GCP Console:

```bash
terraform plan -out=post-corruption.tfplan 2>&1 | tee plan-output.txt
# Look for resources it wants to create that already exist, or destroy things that are running
```

2. Restore state from the last known-good version:

```bash
# List versions
gcloud storage ls --all-versions gs://tf-state-prod-bucket/terraform/state/default.tfstate

# Pull and inspect
terraform state pull > current-state.json
# Compare serial numbers and timestamps

# Restore
gcloud storage cp "gs://tf-state-prod-bucket/terraform/state/default.tfstate#GOOD_GENERATION" ./good-state.tfstate
terraform state push good-state.tfstate
```

3. Import any orphaned resources (created during the lost apply):

```bash
# Example: a Cloud Run service was created but not in restored state
terraform import google_cloud_run_v2_service.data_api \
  projects/your-project/locations/europe-west3/services/data-api
```

---

## High — Infrastructure Drift / Team Blocking

---

### Team Blocking — State Drift (Manual Console Changes)

**What happens**

On a Friday evening, the vendor data feed stops arriving. An on-call engineer investigates and finds the ingestion Cloud Run job can't reach the vendor's SFTP server. To restore the pipeline before market close, they add a firewall rule in the GCP Console — `allow-vendor-sftp-egress` — directly, without going through Terraform. The issue is resolved. On Monday, a teammate runs `terraform apply` to add a new GCS bucket. The apply runs a refresh, detects the manually-added firewall rule, and plans to DELETE it (it's not in state). The apply runs. The firewall rule is gone. The vendor feed breaks again.

**Root cause**

Terraform's state file is the source of truth for what Terraform manages. Resources created outside Terraform are invisible to it. When Terraform refreshes state (which happens automatically on every plan/apply), it compares GCP's actual state to the Terraform state. A resource that exists in GCP but not in state is either ignored (if unmanaged) or causes drift when it conflicts with Terraform-managed resources. Manual changes to Terraform-managed resources (like firewall rules) appear as drift and are reverted on the next apply.

**Consequences**

- Hotfixes silently reverted on next apply — the problem recurs without warning
- Drift accumulates over time: production infrastructure gradually diverges from what the code says
- Audits of `.tf` files no longer accurately represent production — EU BMR compliance issue
- Engineers lose trust in Terraform ("why do I use this if it keeps undoing my fixes?")
- Drift in IAM bindings can silently grant or revoke access

**Prevention protocol**

1. Run scheduled drift detection — `terraform plan -refresh-only` detects drift without applying:

```yaml
# .github/workflows/drift-detection.yml
name: Terraform Drift Detection

on:
  schedule:
    - cron: '0 6 * * 1-5'  # Every weekday at 6am
  workflow_dispatch:

jobs:
  drift-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: "~1.9"

      - name: Authenticate to GCP
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Terraform Init
        run: terraform init

      - name: Drift Detection
        id: drift
        run: |
          terraform plan -refresh-only -detailed-exitcode -out=drift.tfplan 2>&1 | tee drift-output.txt
          EXIT_CODE=${PIPESTATUS[0]}
          if [ $EXIT_CODE -eq 2 ]; then
            echo "DRIFT_DETECTED=true" >> $GITHUB_OUTPUT
            echo "Drift detected in production infrastructure!"
          elif [ $EXIT_CODE -eq 0 ]; then
            echo "DRIFT_DETECTED=false" >> $GITHUB_OUTPUT
            echo "No drift detected."
          else
            echo "Plan failed - investigate."
            exit 1
          fi

      - name: Notify on drift
        if: steps.drift.outputs.DRIFT_DETECTED == 'true'
        run: |
          # Post to Slack/Teams with drift details
          cat drift-output.txt
          # In production: post to #infra-alerts Slack channel
```

2. Team policy: ALL infrastructure changes go through Terraform. Emergency hotfixes use a break-glass procedure that creates a Terraform PR simultaneously.

3. Document the break-glass procedure in the runbook:

```bash
# Emergency hotfix procedure (when Terraform PR cycle is too slow):
# 1. Make the change in GCP Console
# 2. Immediately open a Terraform PR to codify the change
# 3. Comment on the PR: "HOTFIX: Applied manually on <date> due to <incident>"
# 4. Apply the PR within 24 hours
# 5. Run 'terraform plan -refresh-only' to verify no drift remains
```

**Fix procedure**

1. Identify the drift:

```bash
terraform plan -refresh-only -out=drift.tfplan
terraform show drift.tfplan  # Review what drifted
```

2. Option A — Absorb the drift (the manual change was correct):

```bash
# Apply the refresh-only plan to update state to match GCP reality
terraform apply drift.tfplan  # This updates STATE only, does not change GCP resources

# Then update the .tf code to match the manual change:
# Add the firewall rule to firewall.tf, then run terraform apply to bring it under management
resource "google_compute_firewall" "allow_vendor_sftp_egress" {
  name    = "allow-vendor-sftp-egress"
  network = google_compute_network.data_platform.name
  # ...
}
```

3. Option B — Revert the drift (the manual change was wrong):

```bash
# Run a normal terraform apply — it will revert the manual change to match .tf code
terraform apply  # Reverts the drift
```

---

### Concurrent Applies Without Locking

**What happens**

The team migrated from local state files to GCS backend three months ago but didn't verify that locking was actually working. Two engineers both run `terraform apply` simultaneously — one adding a new BigQuery dataset, one updating a Cloud Run service. Neither gets a lock error. Both applies complete. The final state reflects only one of them. The other engineer's change appears to have applied (no error) but their resource is not in state and will be recreated or show phantom diffs on every future plan.

**Root cause**

GCS backend locking is implemented via a lock file in the GCS bucket. If the bucket has write restrictions, inconsistent IAM permissions, or the backend was configured incorrectly, locking may fail silently. Additionally, if engineers are using different backend configurations (different `prefix` values), their applies hit different state files and neither sees the other's lock.

**Consequences**

- Race condition corrupts state — last writer wins
- Resources created by the "losing" apply are orphaned
- Team member whose change was "lost" wastes time debugging why their change didn't persist
- IAM changes that were "lost" can create security gaps (a revoked permission re-appears)

**Prevention protocol**

1. Verify GCS backend locking is working with a test:

```bash
# Terminal 1: Start a long apply (or use plan -lock=true to just acquire the lock)
terraform apply -lock=true -lock-timeout=120s

# Terminal 2: Try to acquire the lock simultaneously
terraform plan
# Should see: "Error acquiring the state lock"
# The error message contains the lock ID and creation time — confirms locking works
```

2. Correct GCS backend configuration:

```hcl
# backend.tf
terraform {
  backend "gcs" {
    bucket = "tf-state-prod-bucket"  # Single bucket, single prefix per environment
    prefix = "terraform/state/prod"   # Consistent prefix — everyone uses the same path
  }
}
```

3. Use CI/CD as the only apply path for production — this eliminates the possibility of concurrent local applies:

```yaml
# .github/workflows/terraform-apply.yml
# Concurrency group ensures only one apply runs at a time per environment
concurrency:
  group: terraform-apply-prod
  cancel-in-progress: false  # Do NOT cancel in-progress applies
```

4. Verify state bucket permissions allow locking (SA needs both read and write):

```hcl
resource "google_storage_bucket_iam_member" "tf_state_admin" {
  bucket = google_storage_bucket.tf_state.name
  role   = "roles/storage.objectAdmin"  # Required for lock file create/delete
  member = "serviceAccount:terraform-ci@your-project.iam.gserviceaccount.com"
}
```

**Fix procedure**

1. Immediately halt all applies:

```bash
# Check who is currently holding a lock (if any)
gcloud storage cat gs://tf-state-prod-bucket/terraform/state/prod/default.tfstate.tflock
```

2. Pull current state and audit against GCP Console for missing resources:

```bash
terraform state pull | jq '[.resources[] | .type + "." + .name]' | sort
# Compare to what actually exists in GCP Console
```

3. Import any orphaned resources and run a reconciling apply.

---

### `prevent_destroy` Doesn't Prevent Removal from Config

**What happens**

An engineer refactors the networking module and accidentally deletes the `google_compute_instance.airflow` resource block from `compute.tf`. They had previously added `prevent_destroy = true` to the lifecycle block, so they assume the VM is protected. `terraform plan` shows: `# google_compute_instance.airflow will be destroyed`. The engineer is confused — they thought `prevent_destroy` would stop this. They approve the plan. The Airflow VM is deleted.

**Root cause**

`prevent_destroy = true` is a Terraform-level lifecycle guard that raises an error if a Terraform *operation* (like `apply` after a config change that would trigger deletion) tries to destroy the resource. However, this guard only applies when the resource block still EXISTS in the configuration. When the resource block is removed from `.tf` files entirely, Terraform removes it from the plan phase as well — including the lifecycle block. There is no resource block left to enforce the lifecycle rule. Terraform treats the removal from config as an intent to delete.

`deletion_protection` at the GCP API level is the real protection — it makes GCP refuse the delete API call regardless of who makes it.

**Consequences**

- Airflow VM deleted: all active DAG runs fail, scheduled ingestion stops, vendor data pipeline halts
- Data gaps in BigQuery — index calculations delayed or impossible until VM is restored
- Confusion about the difference between TF and GCP-level protection leads to future mistakes

**Prevention protocol**

1. Understand the difference and use BOTH:

```hcl
resource "google_compute_instance" "airflow" {
  name                = "airflow-prod"
  machine_type        = "e2-standard-4"
  zone                = "europe-west3-b"
  deletion_protection = true  # GCP-level: API refuses delete calls. Survives TF config removal.

  # ...

  lifecycle {
    prevent_destroy = true  # TF-level: errors if TF config changes would cause deletion.
                             # Does NOT protect against resource block removal from config.
  }
}
```

2. Add CODEOWNERS for critical infrastructure files:

```
# .github/CODEOWNERS
/terraform/compute.tf @senior-engineer @infra-lead
/terraform/networking.tf @senior-engineer @infra-lead
/terraform/iam.tf @senior-engineer @infra-lead
```

3. CI plan review gate: require explicit approval for any destroy in PRs:

```yaml
# .github/workflows/terraform-plan.yml
- name: Post plan to PR
  run: |
    PLAN=$(terraform show -no-color plan.tfplan)
    DESTROYS=$(terraform show -json plan.tfplan | jq '[.resource_changes[] | select(.change.actions[] == "delete")] | length')
    if [ "$DESTROYS" -gt "0" ]; then
      echo "## ⚠️ PLAN CONTAINS $DESTROYS RESOURCE DELETIONS — REQUIRES EXPLICIT APPROVAL" >> $GITHUB_STEP_SUMMARY
    fi
```

**Fix procedure**

1. If `deletion_protection = true` was set at GCP level, the VM was NOT deleted. Terraform errored:

```bash
# Error message from GCP: "The resource 'projects/.../instances/airflow-prod' cannot be deleted
# because it has a deletion protection policy."
# The resource still exists in GCP. Re-add the resource block to compute.tf and re-import if needed.
terraform import google_compute_instance.airflow \
  projects/your-project/zones/europe-west3-b/instances/airflow-prod
```

2. If `deletion_protection` was NOT set and the VM was deleted, restore from snapshot (see Problem 1 fix procedure).

---

### Provider Version Mismatch Across Team

**What happens**

Engineer A upgrades the Google Terraform provider from v5.x to v6.5 on their Mac (Apple Silicon). They run `terraform init`, which regenerates `.terraform.lock.hcl` with hashes for `darwin_arm64`. They commit and push. CI on Ubuntu Linux (`linux_amd64`) fails: `Error: Inconsistent dependency lock file`. A Windows-based teammate also fails. The team is blocked on all Terraform operations until the lock file is fixed.

**Root cause**

The `.terraform.lock.hcl` file records cryptographic hashes of provider binaries for specific platforms. When `terraform init` runs on a new platform (e.g., `linux_amd64`) and the lock file only contains hashes for `darwin_arm64`, Terraform refuses to proceed — it cannot verify the provider binary is authentic. The lock file must explicitly include hashes for all platforms used by the team and CI.

**Consequences**

- All CI pipelines blocked — no deploys possible
- Windows/Linux team members cannot run any Terraform commands
- If an urgent infrastructure change is needed (incident response), the team is blocked until the lock file is fixed
- Wasted debugging time — the error message is not always obvious about the cause

**Prevention protocol**

1. Always regenerate the lock file for ALL platforms before committing:

```bash
# Run this whenever upgrading or adding providers
terraform providers lock \
  -platform=linux_amd64 \
  -platform=darwin_arm64 \
  -platform=darwin_amd64 \
  -platform=windows_amd64

# This fetches hashes for all four platforms and writes them to .terraform.lock.hcl
```

2. Add a CI step that validates the lock file covers all required platforms:

```yaml
# .github/workflows/terraform-validate.yml
- name: Validate lock file covers required platforms
  run: |
    LOCK_FILE=".terraform.lock.hcl"
    for PLATFORM in "linux_amd64" "darwin_arm64" "windows_amd64"; do
      if ! grep -q "$PLATFORM" "$LOCK_FILE"; then
        echo "ERROR: Lock file missing platform: $PLATFORM"
        echo "Run: terraform providers lock -platform=linux_amd64 -platform=darwin_arm64 -platform=windows_amd64"
        exit 1
      fi
    done
    echo "Lock file covers all required platforms."
```

3. Document the provider upgrade process in CONTRIBUTING.md:

```markdown
## Upgrading Terraform Providers

1. Update the version constraint in `versions.tf`
2. Run `terraform init -upgrade`
3. Run `terraform providers lock -platform=linux_amd64 -platform=darwin_arm64 -platform=windows_amd64`
4. Commit BOTH `versions.tf` and `.terraform.lock.hcl`
5. Verify CI passes before merging
```

**Fix procedure**

```bash
# Fast fix: regenerate lock file with all platforms
terraform providers lock \
  -platform=linux_amd64 \
  -platform=darwin_arm64 \
  -platform=darwin_amd64 \
  -platform=windows_amd64

# Commit the updated .terraform.lock.hcl
git add .terraform.lock.hcl
git commit -m "fix: regenerate lock file with all platforms"
git push
```

---

### Terraform Module Version Breaking Changes

**What happens**

The team upgrades `terraform-google-modules/network/google` from v8.1 to v9.0 for new subnet features. The upgrade changes how subnets are internally addressed in the module's state. `terraform plan` shows: "15 to destroy, 15 to add" — VPC, all subnets, firewall rules, and Cloud NAT. Applying this plan would destroy and recreate the entire network while the index calculation VM is attached to it. The SQL Server VM would lose connectivity. The Airflow VM would lose connectivity.

**Root cause**

Terraform modules use internal resource addresses to track state. When a module version refactors internal resource naming (e.g., from `google_compute_subnetwork.subnetwork["subnet-eu"]` to `google_compute_subnetwork.subnets["subnet-eu"]`), Terraform sees a new resource address and an old one — plan = destroy old + create new. Even if the underlying GCP resource is identical, the state address change triggers recreation.

**Consequences**

- Network destruction during business hours: VMs lose connectivity, Cloud Run jobs fail, Cloud NAT routes disappear
- Data pipeline completely offline during recreation (15–30 minutes minimum)
- If subnets are recreated, all static IP reservations and firewall rules may need re-association
- Breaking a network module upgrade can block all other Terraform work until resolved

**Prevention protocol**

1. Pin module versions with pessimistic constraint operators:

```hcl
# versions.tf
module "vpc" {
  source  = "terraform-google-modules/network/google"
  version = "~> 8.1"  # Allow patch updates (8.1.x) but NOT minor/major (9.x)

  project_id   = var.project_id
  network_name = "data-platform-vpc"
  routing_mode = "REGIONAL"
  # ...
}
```

2. Before upgrading, read the module's CHANGELOG and look for "breaking changes":

```bash
# Check the module changelog before upgrading
open https://github.com/terraform-google-modules/terraform-google-network/blob/master/CHANGELOG.md
```

3. Test upgrades in dev workspace FIRST and verify plan shows no unexpected destroys:

```bash
terraform workspace select dev
# Update version constraint to v9.0 in versions.tf
terraform init -upgrade
terraform plan -out=upgrade-test.tfplan
# Check for destroys
terraform show -json upgrade-test.tfplan | jq '[.resource_changes[] | select(.change.actions[] == "delete")] | .[]'
```

**Fix procedure**

1. Revert to the previous module version immediately:

```bash
# Revert versions.tf to previous version
git checkout HEAD~1 -- versions.tf
terraform init -upgrade  # Downgrades the provider
terraform plan  # Should show 0 changes if state is intact
```

2. If upgrade is necessary, use `moved` blocks to map old addresses to new ones:

```hcl
# moved.tf — map old module addresses to new ones to avoid destroy+create
moved {
  from = module.vpc.google_compute_subnetwork.subnetwork["subnet-eu-1"]
  to   = module.vpc.google_compute_subnetwork.subnets["subnet-eu-1"]
}
```

---

### Monolithic State File (Single State for Everything)

**What happens**

The entire data platform infrastructure lives in one Terraform root module: 15 VMs, 20+ GCS buckets, 10 BigQuery datasets, 30+ IAM bindings, 5 Cloud Run services, Pub/Sub topics, firewall rules, Cloud NAT, Artifact Registry. `terraform plan` takes 9 minutes to refresh all 250+ resources via GCP API. When Engineer A's apply runs, it locks the state for 18 minutes, during which no other team member can plan or apply anything. Adding a single variable to a Cloud Run job requires locking the entire infrastructure state.

**Root cause**

Terraform state is a single file per workspace. All operations (plan, apply, import, state manipulation) acquire an exclusive lock on that file. The more resources in state, the longer every operation takes — both for API refresh calls and for the actual apply. There is no parallelism at the state level; operations are serialized by the lock.

**Consequences**

- Teams block each other: a networking change locks everyone out of deploying a data pipeline fix
- Slow feedback loops: 9-minute plans discourage careful pre-apply checks
- CI pipelines queue and time out waiting for state locks
- Blast radius of a single bad apply is the entire platform
- In an incident, the 18-minute lock means no one can apply the emergency fix while the current apply runs

**Prevention protocol**

Split state by domain. Each domain has its own state file, its own plan/apply cycle, and its own lock:

```
terraform/
├── networking/          # VPC, subnets, firewall rules, Cloud NAT — changes rarely
│   ├── main.tf
│   ├── backend.tf       # prefix = "terraform/state/prod/networking"
│   └── outputs.tf       # Exports: network_id, subnet_id
├── compute/             # VMs (SQL Server, Airflow) — changes occasionally
│   ├── main.tf
│   ├── backend.tf       # prefix = "terraform/state/prod/compute"
│   └── data.tf          # Uses terraform_remote_state to read networking outputs
├── data-platform/       # GCS, BigQuery, Pub/Sub — changes frequently
│   ├── main.tf
│   └── backend.tf       # prefix = "terraform/state/prod/data-platform"
├── iam/                 # IAM bindings, service accounts — separate for audit
│   ├── main.tf
│   └── backend.tf       # prefix = "terraform/state/prod/iam"
└── serverless/          # Cloud Run, Cloud Scheduler — changes most frequently
    ├── main.tf
    └── backend.tf       # prefix = "terraform/state/prod/serverless"
```

Cross-domain references via `terraform_remote_state`:

```hcl
# compute/data.tf
data "terraform_remote_state" "networking" {
  backend = "gcs"
  config = {
    bucket = "tf-state-prod-bucket"
    prefix = "terraform/state/prod/networking"
  }
}

resource "google_compute_instance" "sql_server_prod" {
  # ...
  network_interface {
    subnetwork = data.terraform_remote_state.networking.outputs.subnet_id
  }
}
```

**Fix procedure**

Migrating from monolithic to split state is a careful process:

```bash
# 1. Create the new backend config for a domain (e.g., networking)
# 2. Move relevant resources to the new state:
terraform state mv -state=monolith.tfstate -state-out=networking.tfstate \
  google_compute_network.data_platform \
  google_compute_subnetwork.subnet_eu \
  google_compute_firewall.allow_internal

# 3. Initialize the new backend and push the extracted state:
cd terraform/networking/
terraform init
terraform state push networking.tfstate

# 4. Remove migrated resources from the monolithic state:
terraform state rm google_compute_network.data_platform
# Repeat for all migrated resources

# 5. Verify both states are consistent with terraform plan
```

---

## Moderate — Operational Pain

---

### Plan Differs from Apply (Plan Staleness)

**What happens**

An engineer opens a PR, CI runs `terraform plan`, the output looks good. A reviewer approves the PR. While waiting for the merge queue, a teammate merges a different PR that also runs `terraform apply`. When the first PR finally applies, Terraform generates a fresh plan internally — different from what was reviewed in the PR. The apply proceeds with unreviewed changes. In a financial regulated environment, this violates the "four-eyes" principle for infrastructure changes.

**Root cause**

`terraform apply` without a saved plan file ALWAYS re-runs the planning phase internally, using the current state and current GCP API responses. The plan displayed in the PR is therefore advisory only — it reflects the state at plan time, not apply time. Any change to state between plan and apply (another apply, drift, manual changes) produces a different actual apply.

**Consequences**

- Reviewed plan ≠ applied plan: breaks the audit trail for EU BMR compliance
- Silent unexpected changes applied to production
- Trust in the CI/CD review process erodes

**Prevention protocol**

1. Use saved plan files — the only way to guarantee what was reviewed is what gets applied:

```yaml
# .github/workflows/terraform-plan.yml
- name: Terraform Plan (Save)
  run: terraform plan -out=plan.tfplan -input=false

- name: Upload saved plan
  uses: actions/upload-artifact@v4
  with:
    name: terraform-plan-${{ github.sha }}
    path: plan.tfplan
    retention-days: 7

# .github/workflows/terraform-apply.yml (runs after PR approval)
- name: Download saved plan
  uses: actions/download-artifact@v4
  with:
    name: terraform-plan-${{ github.sha }}

- name: Terraform Apply (from saved plan only)
  run: terraform apply plan.tfplan  # Applies EXACTLY what was planned — no re-planning
```

2. Verify the saved plan's state serial hasn't changed before applying:

```bash
# Extract the state serial from the saved plan
PLAN_SERIAL=$(terraform show -json plan.tfplan | jq '.prior_state.serial')
# Extract current state serial
CURRENT_SERIAL=$(terraform state pull | jq '.serial')
if [ "$PLAN_SERIAL" != "$CURRENT_SERIAL" ]; then
  echo "ERROR: State has changed since plan was generated. Re-plan required."
  exit 1
fi
```

**Fix procedure**

```bash
# If a stale plan was applied: immediately run terraform plan to assess the current state
terraform plan -out=reconcile.tfplan
terraform show reconcile.tfplan  # Review what the current delta is
# Apply the reconciling plan after review
terraform apply reconcile.tfplan
```

---

### Workspace Confusion (Applied to Wrong Environment)

**What happens**

An engineer has been working all day in the `dev` workspace. Late in the afternoon, they switch to `prod` to check something, get distracted, then return to their terminal. They run `terraform apply` on their dev-targeted change. The prompt says `Do you want to perform these actions in workspace "prod"?`. They type `yes` automatically. The "dev-only" change — a smaller VM type for cost savings — is now applied to the production SQL Server VM. The index calculation engine is now running on an undersized VM.

**Root cause**

Terraform workspace state is stored in the shell session. There is no persistent visual indicator in most terminal setups. Engineers working across multiple terminals or after context switches frequently lose track of which workspace is active.

**Consequences**

- Dev configuration applied to prod: wrong machine types, wrong network configs, dev-grade IAM
- Production performance degradation or downtime
- Confusion about why prod and dev configs differ — hard to diagnose
- EU BMR: untracked changes to production infrastructure

**Prevention protocol**

1. Display the Terraform workspace in the shell prompt (add to `.bashrc` or `.zshrc`):

```bash
# .bashrc / .zshrc
parse_tf_workspace() {
  if [ -f .terraform/environment ]; then
    cat .terraform/environment
  fi
}

# For bash PS1:
export PS1='[\u@\h \W $(parse_tf_workspace)]\$ '

# For zsh (in ~/.zshrc):
RPROMPT='$(parse_tf_workspace)'
```

2. Add workspace assertion at the top of CI apply workflow:

```yaml
- name: Assert correct workspace for environment
  run: |
    WORKSPACE=$(terraform workspace show)
    EXPECTED_WORKSPACE="${{ inputs.environment }}"  # Passed as workflow input
    if [ "$WORKSPACE" != "$EXPECTED_WORKSPACE" ]; then
      echo "ERROR: Expected workspace '$EXPECTED_WORKSPACE', got '$WORKSPACE'"
      exit 1
    fi
```

3. Use separate state buckets per environment (not just workspaces in the same bucket) — makes accidental cross-environment applies much harder:

```hcl
# backend-prod.tf (only used in prod CI)
terraform {
  backend "gcs" {
    bucket = "tf-state-PROD-bucket"   # Distinct bucket name makes it obvious
    prefix = "terraform/state"
  }
}

# backend-dev.tf (used in dev)
terraform {
  backend "gcs" {
    bucket = "tf-state-DEV-bucket"
    prefix = "terraform/state"
  }
}
```

**Fix procedure**

```bash
# Immediately run terraform plan to assess damage
terraform workspace select prod
terraform plan  # Shows delta between current prod state and correct prod config

# Revert by applying the correct prod configuration
terraform apply -var-file=prod.tfvars
```

---

### Circular Dependencies

**What happens**

A Cloud Run service needs a custom service account with specific IAM bindings. The IAM binding resource references the Cloud Run service (to grant it permission to invoke). The Cloud Run service references the service account. Terraform errors: `Error: Cycle: google_cloud_run_v2_service.data_api, google_service_account.cloud_run_sa, google_project_iam_member.cloud_run_invoker`. Terraform cannot determine which resource to create first.

**Root cause**

Terraform builds a directed acyclic graph (DAG) of resource dependencies. When Resource A depends on Resource B and Resource B depends on Resource A, the graph has a cycle and cannot be resolved. Cycles commonly occur with IAM resources that reference the resource they're granting access to, or with VPC resources that reference each other for peering.

**Consequences**

- Terraform refuses to plan or apply until the cycle is broken
- New infrastructure cannot be deployed
- Team members spend hours debugging dependency errors

**Prevention protocol**

1. Break IAM ↔ resource cycles by separating concerns — create the service account independently:

```hcl
# WRONG: Circular dependency
resource "google_cloud_run_v2_service" "data_api" {
  name     = "data-api"
  location = var.region

  template {
    service_account = google_service_account.cloud_run_sa.email  # SA depends on this resource
  }
}

resource "google_project_iam_member" "cloud_run_invoker" {
  project = var.project_id
  role    = "roles/run.invoker"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
  # This creates the cycle if the service account references the Cloud Run service
}
```

```hcl
# CORRECT: Break the cycle with explicit depends_on or by separating resource creation
resource "google_service_account" "cloud_run_sa" {
  account_id   = "cloud-run-data-api"
  display_name = "Cloud Run Data API Service Account"
  project      = var.project_id
  # No reference to the Cloud Run service — standalone resource
}

resource "google_cloud_run_v2_service" "data_api" {
  name     = "data-api"
  location = var.region

  template {
    service_account = google_service_account.cloud_run_sa.email
  }

  depends_on = [google_service_account.cloud_run_sa]  # Explicit, unambiguous
}

resource "google_project_iam_member" "cloud_run_invoker" {
  project    = var.project_id
  role       = "roles/run.invoker"
  member     = "serviceAccount:${google_service_account.cloud_run_sa.email}"
  depends_on = [google_service_account.cloud_run_sa]  # Not dependent on Cloud Run service
}
```

**Fix procedure**

```bash
# Identify the cycle from Terraform's error output
# Then restructure as shown above — use depends_on to make dependencies explicit and acyclic
terraform validate  # Confirms cycle is resolved before planning
terraform plan
```

---

### `-target` Flag Misuse (Partial State)

**What happens**

An engineer needs to quickly update a single Cloud Run job image without touching anything else. They use `terraform apply -target=google_cloud_run_v2_job.data_ingestion`. The apply succeeds. Two weeks later, a teammate runs a full `terraform plan` and sees unexpected diffs — resources that weren't targeted now show phantom changes because their dependencies were partially updated. The state is inconsistent: some resources reflect the latest config, others reflect an older snapshot.

**Root cause**

`-target` applies changes only to the specified resource and its direct dependencies. All other resources retain their previous state values. If any config changes outside the targeted resource affect downstream resources (e.g., a variable used in multiple places), those downstream resources still show diffs on the next full plan. State becomes a patchwork of different apply points in time.

**Consequences**

- Phantom diffs on every subsequent plan — engineers can't tell what's real and what's an artifact
- Risk of accidentally applying a large unreviewed diff when someone finally does a full apply
- Debugging time wasted on diffs that are artifacts of `-target` misuse
- Breaks the "plan === apply" guarantee that makes IaC trustworthy

**Prevention protocol**

1. Use `-target` only for two specific legitimate cases and document it clearly:

```bash
# LEGITIMATE USE 1: Bootstrapping a chicken-and-egg resource
# (e.g., creating the state bucket itself before full init)
terraform apply -target=google_storage_bucket.tf_state
# Comment: "Bootstrap only — follow with full terraform apply"

# LEGITIMATE USE 2: Debugging a single resource during development (never in prod)
terraform plan -target=google_cloud_run_v2_job.data_ingestion  # Plan only, never apply

# NEVER: Using -target in production to avoid reviewing a full plan
```

2. In CI, block `-target` in production applies:

```yaml
- name: Validate apply command (no -target in prod)
  run: |
    if echo "${{ github.event.inputs.terraform_args }}" | grep -q "\-target"; then
      echo "ERROR: -target is not allowed in production applies."
      echo "Always apply the full plan."
      exit 1
    fi
```

**Fix procedure**

After `-target` was used in production, always run a full reconciling apply:

```bash
# After any -target apply, immediately run a full plan
terraform plan -out=reconcile.tfplan
terraform show reconcile.tfplan  # Review ALL diffs, not just the targeted resource

# Apply the full plan to restore state consistency
terraform apply reconcile.tfplan
```

---

### Import Existing Resources Fails

**What happens**

The team built some GCS buckets and BigQuery datasets manually before Terraform was adopted. Now they need to bring all infrastructure under Terraform management for compliance. The engineer adds resource blocks in `.tf` files and runs `terraform import`, but the command fails with "invalid import ID" for several resource types because the ID format varies significantly between GCP resource types. Hours are spent looking up the correct ID format for each resource.

**Root cause**

`terraform import` requires the exact resource address (the Terraform resource block address) and the exact GCP resource ID in the format the provider expects. This format is not standardized — it varies per resource type, and using the GCP Console resource name directly often fails.

**Prevention protocol**

Use the Terraform 1.5+ `import` block for declarative imports (no manual command needed):

```hcl
# import.tf — declarative import (Terraform 1.5+)
import {
  to = google_storage_bucket.vendor_data_landing
  id = "vendor-data-landing-prod"  # Just the bucket name for GCS
}

import {
  to = google_bigquery_dataset.analytics
  id = "projects/your-project-id/datasets/analytics_prod"
}
```

**Fix procedure**

Imperative import commands for common GCP resources:

```bash
# GCS Bucket (just the bucket name, no gs:// prefix)
terraform import google_storage_bucket.vendor_data_landing vendor-data-landing-prod

# BigQuery Dataset
terraform import google_bigquery_dataset.analytics \
  projects/your-project-id/datasets/analytics_prod

# BigQuery Table
terraform import google_bigquery_table.index_data \
  your-project-id/analytics_prod/index_data

# Compute Instance
terraform import google_compute_instance.sql_server_prod \
  projects/your-project-id/zones/europe-west3-b/instances/sql-server-prod

# Service Account
terraform import google_service_account.airflow_sa \
  projects/your-project-id/serviceAccounts/airflow@your-project-id.iam.gserviceaccount.com

# Firewall Rule
terraform import google_compute_firewall.allow_internal \
  projects/your-project-id/global/firewalls/allow-internal

# Pub/Sub Topic
terraform import google_pubsub_topic.index_events \
  projects/your-project-id/topics/index-events

# Secret Manager Secret
terraform import google_secret_manager_secret.db_password \
  projects/your-project-id/secrets/sql-server-db-password

# After importing, always run terraform plan — the imported resource's config
# in .tf files must match the actual GCP state or plan will show diffs
terraform plan  # Shows diffs between imported resource and .tf config
```

---

### Backend Migration Data Loss

**What happens**

A new team member sets up Terraform locally with a local backend (state stored in `terraform.tfstate` on their laptop). They push the code to the repo. The team decides to migrate to GCS remote state. An engineer runs `terraform init` with the new GCS backend config — but forgets the `-migrate-state` flag. Terraform initializes a fresh empty state in GCS. The next `terraform plan` shows every resource needs to be created (Terraform thinks the GCP project is empty). If someone applies, Terraform creates duplicates of everything.

**Root cause**

`terraform init` with a new backend config by default creates a fresh state in the new backend. It does NOT automatically migrate existing local state. The `-migrate-state` flag explicitly instructs Terraform to copy the existing state to the new backend. Without it, the old state and new empty state coexist, and Terraform uses the new empty one.

**Consequences**

- Empty state causes plan to show "create everything" — if applied, creates duplicate resources
- Duplicate GCS buckets fail (names must be globally unique) — apply errors out
- Duplicate VMs create cost and confusion
- Real state is stranded on a local machine or lost if the machine is unavailable

**Prevention protocol**

Always back up and migrate explicitly:

```bash
# Step 1: Back up the existing state
cp terraform.tfstate terraform.tfstate.backup.$(date +%Y%m%d)

# Step 2: Add the new backend config to backend.tf (do not apply yet)
cat > backend.tf << 'EOF'
terraform {
  backend "gcs" {
    bucket = "tf-state-prod-bucket"
    prefix = "terraform/state/prod"
  }
}
EOF

# Step 3: Migrate with the explicit flag
terraform init -migrate-state
# Terraform prompts: "Do you want to copy existing state to the new backend?"
# Type: yes

# Step 4: Verify migration succeeded
terraform state list  # Should show all existing resources
terraform plan        # Should show 0 changes
```

**Fix procedure**

If `init` was run without `-migrate-state` and state was lost:

```bash
# The old state is still on the local machine (terraform.tfstate)
# Copy it to the new GCS backend using state push
terraform state push terraform.tfstate.backup.20260322
# Verify
terraform state list
terraform plan  # Should show 0 changes if migration was successful
```

---

### Sensitive Values in Plan Output / CI Logs

**What happens**

CI runs `terraform plan` and posts the plan output as a comment on the GitHub PR. The plan shows a diff for a Cloud SQL instance where the root password changed. The GitHub PR comment, visible to all repository contributors, shows: `root_password = "SuperSecretPassword123!"`. The password is now in the PR history permanently. Separately, a new team member notices that `terraform plan` output in CI logs shows API keys in full.

**Root cause**

`terraform plan` outputs all changed resource attributes. Resources that contain credentials (database passwords, API keys) will show those credentials in the plan diff unless the provider marks them sensitive or the variable is marked `sensitive = true`. Even with `sensitive = true`, some providers still show values in certain diffs.

**Consequences**

- Credentials exposed to all repository contributors and in GitHub log archives
- In a regulated financial environment, this constitutes a credential exposure incident requiring rotation and reporting
- GitHub logs may be retained for months — credentials remain accessible long after rotation

**Prevention protocol**

1. Mark all sensitive variables and use `sensitive = true`:

```hcl
variable "db_root_password" {
  type      = string
  sensitive = true  # Redacted in plan output as (sensitive value)
}
```

2. Redact plan output before posting to PR:

```yaml
- name: Terraform Plan
  id: plan
  run: |
    terraform plan -no-color -out=plan.tfplan 2>&1 | \
      sed -E 's/(password|secret|key|token)\s*=\s*"[^"]+"/\1 = (redacted)/gi' \
      > plan-output.txt
    cat plan-output.txt

- name: Post plan to PR
  uses: actions/github-script@v7
  with:
    script: |
      const fs = require('fs');
      const plan = fs.readFileSync('plan-output.txt', 'utf8');
      github.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body: `## Terraform Plan\n\`\`\`\n${plan}\n\`\`\``
      });
```

3. Use Secret Manager pattern (see Problem 4) to ensure secret VALUES never flow through Terraform state.

**Fix procedure**

```bash
# Immediately rotate any exposed credentials
gcloud secrets versions add sql-server-db-password --data-file=- <<< "$(openssl rand -base64 32)"

# Revoke and regenerate any exposed API keys
# Update the secret value in Secret Manager

# Request GitHub support to purge the log/comment if needed for compliance
# Document the incident per EU BMR audit requirements
```

---

## Low — Annoyances / Team Friction

---

### HCL Formatting Inconsistency

**What happens**

Different engineers use different editors with different indentation settings. Over time, `.tf` files have mixed indentation (2 spaces, 4 spaces, tabs), inconsistent bracket placement, and misaligned `=` signs. PRs have large formatting-only diffs that obscure actual logic changes. Code review time is wasted on formatting debates.

**Root cause**

Terraform has a canonical formatting standard enforced by `terraform fmt`. If not automated, engineers with different editors produce inconsistent formatting. When `fmt` is run ad-hoc, it produces large diffs that mix formatting with logic changes — making PRs harder to review.

**Prevention protocol**

1. Add `terraform fmt` to a pre-commit hook:

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/antonbabenko/pre-commit-terraform
    rev: v1.96.1
    hooks:
      - id: terraform_fmt
        args:
          - --args=-recursive
      - id: terraform_validate
      - id: terraform_tflint
```

2. Enforce in CI:

```yaml
# .github/workflows/terraform-validate.yml
- name: Check Terraform formatting
  run: |
    terraform fmt -check -recursive
    if [ $? -ne 0 ]; then
      echo "Formatting issues found. Run 'terraform fmt -recursive' and commit."
      exit 1
    fi
```

**Fix procedure**

```bash
# Format all .tf files recursively
terraform fmt -recursive
git add -A
git commit -m "style: apply terraform fmt"
```

---

### `terraform init` Required After Every Change

**What happens**

A team member adds a new module or changes a provider version. Other engineers pull the change and immediately run `terraform plan` — it fails with `Error: Module not installed` or `Error: Required plugins are not installed`. They have to remember to run `terraform init` after every `git pull` that touches `versions.tf`, `backend.tf`, or module sources.

**Root cause**

`terraform init` downloads and installs providers and modules into the `.terraform` directory (not committed to git). Any change to provider requirements or module sources requires re-running `init` to download new versions.

**Prevention protocol**

1. Add a Makefile target that chains init + plan:

```makefile
# Makefile
.PHONY: plan apply init

init:
	terraform init -upgrade

plan: init
	terraform plan -out=plan.tfplan

apply:
	terraform apply plan.tfplan
```

2. In CI, always run `terraform init` before any other Terraform command:

```yaml
# .github/workflows/terraform-plan.yml
- name: Terraform Init
  run: terraform init -backend-config=backend-prod.hcl
  # Always runs — never skip init
```

3. Document in `CONTRIBUTING.md`:

```markdown
## After pulling changes

If `versions.tf`, `backend.tf`, or any module `source` was changed:
```bash
terraform init -upgrade
```
When in doubt, run init — it's idempotent.
```

---

### Hardcoded Values Instead of Variables

**What happens**

Project IDs, regions, machine types, and disk sizes are hardcoded throughout `.tf` files. When the team needs to spin up a dev environment, they duplicate the entire `terraform/` directory and do find-replace for `europe-west3`, `your-project-prod`, and VM types. The two copies diverge. Changes in one don't make it to the other.

**Root cause**

Hardcoded values make infrastructure non-reusable. The DRY (Don't Repeat Yourself) principle applies to IaC as much as application code. Without variables, each environment is a maintenance burden.

**Prevention protocol**

1. Use a consistent variable structure with validation:

```hcl
# variables.tf
variable "project_id" {
  type        = string
  description = "The GCP project ID."

  validation {
    condition     = length(var.project_id) > 6
    error_message = "Project ID must be a valid GCP project ID."
  }
}

variable "region" {
  type        = string
  description = "The GCP region for all resources."
  default     = "europe-west3"

  validation {
    condition     = contains(["europe-west3", "europe-west4"], var.region)
    error_message = "Region must be an approved EU region for BMR compliance."
  }
}

variable "environment" {
  type        = string
  description = "Deployment environment: dev, staging, prod."

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "sql_server_machine_type" {
  type        = string
  description = "Machine type for the SQL Server index calculation VM."
  default     = "n2-standard-8"
}
```

2. Use per-environment `.tfvars` files:

```hcl
# environments/prod.tfvars
project_id              = "data-platform-prod"
region                  = "europe-west3"
environment             = "prod"
sql_server_machine_type = "n2-standard-8"

# environments/dev.tfvars
project_id              = "data-platform-dev"
region                  = "europe-west3"
environment             = "dev"
sql_server_machine_type = "e2-standard-4"  # Smaller for cost
```

```bash
# Apply with the correct tfvars file
terraform apply -var-file=environments/prod.tfvars
```

---

### No Remote State Data Isolation

**What happens**

One Terraform state exposes all outputs via `terraform_remote_state`, including the SQL Server connection string and service account keys. Every other state module can read all of these outputs — including engineers working on unrelated components who don't need access to the database credentials.

**Root cause**

`terraform_remote_state` exposes ALL outputs from a state as a single data source. There is no output-level access control. Any state that can read the remote state reads everything.

**Prevention protocol**

1. Minimize sensitive outputs — only expose what is genuinely needed by other modules:

```hcl
# networking/outputs.tf — only expose network topology, never credentials
output "vpc_id" {
  value = google_compute_network.data_platform.id
}

output "subnet_ids" {
  value = { for k, v in google_compute_subnetwork.subnets : k => v.id }
}

# DO NOT output:
# output "db_password" { ... }  # Never expose credentials via remote state
```

2. Use specific GCP data sources instead of remote state where possible — they're more granular:

```hcl
# Instead of reading an entire remote state to get a VPC name:
data "google_compute_network" "data_platform" {
  name    = "data-platform-vpc"
  project = var.project_id
}
# This reads only what you need and doesn't expose the full remote state
```

---

### Slow Plan on Large Infrastructure

**What happens**

Running `terraform plan` on the monolithic state takes 8 minutes. Engineers stop running plan before making changes because it's too slow. They apply without reviewing the plan. Or they use `-refresh=false` for speed — but then miss drift.

**Root cause**

Every `terraform plan` calls the GCP API to refresh the current state of all managed resources. 200+ resources × multiple API calls per resource = thousands of API calls. GCP rate limits and network latency compound to create multi-minute plan times.

**Prevention protocol**

1. State splitting is the primary fix (see Problem 11).

2. Use `-refresh=false` ONLY for syntax validation and CI format checks, NEVER for production applies:

```bash
# Fast syntax/config validation only (does NOT check GCP reality):
terraform plan -refresh=false -out=syntax-check.tfplan

# Always use full refresh for production plans:
terraform plan -out=plan.tfplan  # No -refresh=false
```

3. Use `-parallelism` to increase concurrent API calls (default is 10):

```bash
terraform plan -parallelism=20  # Increase parallel API refreshes
# Use with caution — too high can hit GCP rate limits
```

---

### `.terraform` Directory Committed to Git

**What happens**

A new team member clones the repo and runs `terraform init`. They then stage all files with `git add -A` and commit. The `.terraform/` directory — containing provider binaries for their platform (hundreds of MB) — is now in the repository. Git operations slow to a crawl. Other team members pull a 500MB update.

**Root cause**

`.terraform/` is a local cache directory that should never be committed. It contains platform-specific provider binaries, module downloads, and local backend configuration. It is regenerated by `terraform init` on each machine.

**Prevention protocol**

1. Add a comprehensive `.gitignore`:

```gitignore
# .gitignore — Terraform
.terraform/
.terraform.tfstate
*.tfstate
*.tfstate.backup
*.tfstate.lock.info
*.tfplan
override.tf
override.tf.json
*_override.tf
*_override.tf.json
.terraformrc
terraform.rc

# But DO commit:
# .terraform.lock.hcl  (the dependency lock file — this goes in git)
!.terraform.lock.hcl
```

2. Add a pre-commit hook to catch accidental staging of `.terraform`:

```yaml
# .pre-commit-config.yaml
- repo: local
  hooks:
    - id: no-terraform-dir
      name: Prevent .terraform directory commits
      entry: bash -c 'git diff --cached --name-only | grep -q "^\.terraform/" && echo "ERROR: Do not commit .terraform/" && exit 1 || exit 0'
      language: system
```

**Fix procedure**

```bash
# Remove from git history (last commit only)
git rm -r --cached .terraform/
git commit -m "fix: remove .terraform directory from tracking"

# For deep history removal, use git filter-branch or BFG Repo Cleaner
# Then notify all team members to re-clone
```

---

### Terraform Version Drift Across Team

**What happens**

The team has three engineers on different Terraform versions: 1.6, 1.7, and 1.9. Engineer A on 1.9 applies changes; state format is updated to 1.9 format. Engineer B on 1.6 tries to run `terraform plan` and gets: `Error: state snapshot was created by a newer version of Terraform`. Engineers on older versions are completely blocked.

**Root cause**

Terraform's state format has a version number. When a newer Terraform version writes state, it may write in a format incompatible with older versions. Additionally, some Terraform features (e.g., `import` blocks, `check` blocks) are version-specific and cause parse errors on older versions.

**Consequences**

- Team members on older Terraform versions are blocked from all operations
- Inconsistent behavior between team members — same code, different results depending on version
- CI may use a different version than local development, causing hidden incompatibilities

**Prevention protocol**

1. Pin Terraform version in the root module:

```hcl
# versions.tf
terraform {
  required_version = "~> 1.9.0"  # Allow 1.9.x but not 1.10+

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.5"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 6.5"
    }
  }
}
```

2. Use `.tool-versions` for automatic version selection (works with asdf, mise):

```
# .tool-versions
terraform 1.9.8
```

3. Or use `tfenv`:

```bash
# .terraform-version (read by tfenv automatically)
echo "1.9.8" > .terraform-version

# Team setup
tfenv install  # Installs the version from .terraform-version
tfenv use      # Switches to it automatically
```

4. Pin the version in CI — must match `.tool-versions`:

```yaml
# .github/workflows/terraform-plan.yml
- name: Setup Terraform
  uses: hashicorp/setup-terraform@v3
  with:
    terraform_version: "1.9.8"  # Exact version, not a range
```

**Fix procedure**

```bash
# All team members: install the correct version with tfenv
tfenv install 1.9.8
tfenv use 1.9.8
terraform version  # Confirm: Terraform v1.9.8

# CI: update the pinned version in GitHub Actions workflow
# Update .tool-versions and .terraform-version in repo root
```

---

## Related

- [[terraform-plan-apply-destroy]] — Core Terraform workflow
- [[terraform-state-management]] — State backend configuration
- [[tf-foundation-and-networking]] — Network resource blocks
- [[tf-compute-and-storage]] — Compute and storage blocks
- [[tf-iam-secrets-serverless]] — IAM, secrets, serverless blocks
- [[tf-data-services]] — BigQuery, Firestore, Dataflow blocks
- [github-actions-data-engineering](/10-GitHub-Actions/github-actions-data-engineering) — CI/CD for Terraform

---

## Sources

- 5 Terraform State Mistakes That Will Destroy Your Infrastructure (Medium)
- Don't Force Unlock Terraform State (StateGraph)
- 13 Biggest Terraform Challenges & Pitfalls (Spacelift)
- 10 Common Terraform Errors & Best Practices (ControlMonkey)
- Strategies to Prevent Accidental Terraform Deletions (Medium)
- Terraform Dependency Lock File Documentation (HashiCorp)
