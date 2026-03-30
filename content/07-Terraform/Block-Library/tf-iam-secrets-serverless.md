---
type: reference
category: terraform
technology:
  - terraform
  - gcp
tags: [security, infrastructure, terraform, iac, gcp]
aliases:
  - terraform iam blocks
  - terraform gcp iam
  - terraform secret manager
  - terraform cloud run
  - terraform cloud functions
  - terraform serverless gcp
keywords:
  - terraform
  - gcp
  - iam
  - service account
  - secret manager
  - cloud run
  - cloud run v2
  - cloud functions
  - cloud scheduler
  - pubsub
  - pub/sub
  - artifact registry
  - workload identity federation
  - github actions
  - project iam
  - resource iam
  - iam member
  - iam binding
  - roles
  - permissions
  - google_service_account
  - google_project_iam_member
  - google_secret_manager_secret
  - google_cloud_run_v2_service
  - google_cloud_run_v2_job
  - google_cloudfunctions2_function
  - google_cloud_scheduler_job
  - google_pubsub_topic
  - google_pubsub_subscription
  - google_artifact_registry_repository
  - data engineering
  - pipeline
  - serverless
  - vpc connector
  - startup probe
  - dead letter topic
  - cleanup policy
  - conditional resource
  - count pattern
description: >
  Atomic Terraform block library for GCP IAM, Secret Manager, Cloud Run (v2),
  Cloud Functions v2, Cloud Scheduler, Pub/Sub, and Artifact Registry. Each
  block is self-contained and heavily commented for copy-paste use in data
  engineering infrastructure.
related:
  - "[moc-terraform](/07-Terraform/moc-terraform)"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Terraform Block Library — IAM, Secrets & Serverless (GCP)

Atomic, copy-paste Terraform blocks for GCP IAM, Secret Manager, Cloud Run v2, Cloud Functions v2, Cloud Scheduler, Pub/Sub, and Artifact Registry. Every argument carries an inline comment explaining its purpose. Blocks are generic and meant to be adapted to any project.

---

## IAM Blocks

### Service Accounts

Service accounts are the identity that GCP resources use to authenticate and authorize actions. Create one SA per workload — never share a SA between unrelated services, and never use the Compute Engine default SA for application code.

#### Pipeline Service Account

Use when: a data pipeline (Dataflow, Cloud Run Job, Composer DAG) needs to read/write GCS, BigQuery, or Pub/Sub on behalf of the pipeline process.

```hcl
# creates the identity for the data pipeline workload
resource "google_service_account" "pipeline" {
  account_id   = "data-pipeline"               # short name; becomes data-pipeline@<project>.iam.gserviceaccount.com
  display_name = "Data Pipeline"               # human-readable label shown in GCP Console IAM page
  description  = "SA for batch/streaming data pipeline jobs"  # optional free-text description
  project      = var.project_id               # GCP project that owns this SA
}
```

#### Dashboard Service Account

Use when: a read-only reporting or dashboarding service (Looker Studio data connector, Metabase, Grafana) needs BigQuery or Monitoring read access without write permissions.

```hcl
# creates the identity for read-only dashboard/reporting services
resource "google_service_account" "dashboard" {
  account_id   = "dashboard-reader"            # becomes dashboard-reader@<project>.iam.gserviceaccount.com
  display_name = "Dashboard Reader"            # shown in GCP Console
  description  = "Read-only SA for BI and dashboarding tools"
  project      = var.project_id
}
```

#### Airflow / Composer Service Account

Use when: Cloud Composer (managed Airflow) orchestrates pipelines and needs to trigger Cloud Run Jobs, submit Dataflow jobs, or read from GCS.

```hcl
# creates the identity for Cloud Composer / Airflow worker nodes
resource "google_service_account" "airflow" {
  account_id   = "airflow-worker"              # becomes airflow-worker@<project>.iam.gserviceaccount.com
  display_name = "Airflow Worker"
  description  = "SA attached to Composer environment worker nodes"
  project      = var.project_id
}
```

#### CI/CD Service Account

Use when: a GitHub Actions workflow or Cloud Build pipeline needs to push Docker images, deploy Cloud Run services, or run Terraform.

```hcl
# creates the identity for CI/CD automation (GitHub Actions, Cloud Build)
resource "google_service_account" "cicd" {
  account_id   = "cicd-deployer"               # becomes cicd-deployer@<project>.iam.gserviceaccount.com
  display_name = "CI/CD Deployer"
  description  = "SA used by GitHub Actions or Cloud Build for deployments"
  project      = var.project_id
}
```

#### Datadog Monitoring Service Account (Conditional)

Use when: the Datadog GCP integration is enabled. The `count` pattern lets you toggle this resource via a variable without removing it from the config.

```hcl
# conditionally creates the Datadog monitoring SA only when dd_enabled = true
resource "google_service_account" "datadog" {
  count        = var.dd_enabled ? 1 : 0        # 1 = create, 0 = skip; toggle via variable

  account_id   = "datadog-monitor"             # becomes datadog-monitor@<project>.iam.gserviceaccount.com
  display_name = "Datadog Monitoring"
  description  = "SA for Datadog GCP integration — read-only monitoring access"
  project      = var.project_id
}
```

---

### Project-Level IAM

`google_project_iam_member` grants a single role to a single principal at the **project** level. Prefer this over `google_project_iam_binding` (which is authoritative and removes unlisted members) unless you need full ownership of role membership.

#### Cloud Run Invoker

Use when: a SA or user needs to call authenticated Cloud Run services via HTTPS.

```hcl
# allows the pipeline SA to invoke authenticated Cloud Run services
resource "google_project_iam_member" "pipeline_run_invoker" {
  project = var.project_id                     # GCP project where the role is granted
  role    = "roles/run.invoker"                # lets the principal send requests to authenticated Cloud Run URLs
  member  = "serviceAccount:${google_service_account.pipeline.email}"  # who receives the role
}
```

#### Cloud Run Developer

Use when: a CI/CD SA needs to deploy new revisions to Cloud Run services.

```hcl
# lets the CI/CD SA deploy new Cloud Run revisions
resource "google_project_iam_member" "cicd_run_developer" {
  project = var.project_id
  role    = "roles/run.developer"              # deploy, update, and manage Cloud Run services and jobs
  member  = "serviceAccount:${google_service_account.cicd.email}"
}
```

#### Logging Viewer

Use when: a dashboard or monitoring SA needs to query Cloud Logging without write access.

```hcl
# grants read-only access to Cloud Logging logs
resource "google_project_iam_member" "dashboard_logging_viewer" {
  project = var.project_id
  role    = "roles/logging.viewer"             # read log entries; cannot write or export
  member  = "serviceAccount:${google_service_account.dashboard.email}"
}
```

#### Monitoring Viewer

Use when: Datadog or a dashboard SA needs to read Cloud Monitoring metrics.

```hcl
# grants read-only access to Cloud Monitoring metrics and dashboards
resource "google_project_iam_member" "datadog_monitoring_viewer" {
  count   = var.dd_enabled ? 1 : 0            # only create if Datadog integration is enabled

  project = var.project_id
  role    = "roles/monitoring.viewer"          # read metrics, dashboards, alerting policies; no write access
  member  = "serviceAccount:${google_service_account.datadog[0].email}"
}
```

#### Compute Viewer

Use when: Datadog or an observability tool needs to enumerate Compute Engine instances for autodiscovery.

```hcl
# lets Datadog list Compute Engine instances for GCE autodiscovery
resource "google_project_iam_member" "datadog_compute_viewer" {
  count   = var.dd_enabled ? 1 : 0

  project = var.project_id
  role    = "roles/compute.viewer"             # read-only view of all Compute Engine resources
  member  = "serviceAccount:${google_service_account.datadog[0].email}"
}
```

#### BigQuery Data Editor

Use when: a pipeline SA needs to write rows into BigQuery tables (not just query them).

```hcl
# lets the pipeline SA insert, update, and delete rows in BigQuery tables
resource "google_project_iam_member" "pipeline_bq_data_editor" {
  project = var.project_id
  role    = "roles/bigquery.dataEditor"        # create/update/delete tables and rows; does NOT allow running queries
  member  = "serviceAccount:${google_service_account.pipeline.email}"
}
```

#### BigQuery Job User

Use when: any SA needs to run BigQuery queries (required in addition to data roles).

```hcl
# lets the pipeline SA submit and run BigQuery query jobs
resource "google_project_iam_member" "pipeline_bq_job_user" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"           # required to run queries; does NOT grant data access on its own
  member  = "serviceAccount:${google_service_account.pipeline.email}"
}
```

#### Dataflow Developer

Use when: the pipeline SA needs to launch and manage Dataflow streaming or batch jobs.

```hcl
# lets the pipeline SA submit Dataflow jobs and read job status
resource "google_project_iam_member" "pipeline_dataflow_developer" {
  project = var.project_id
  role    = "roles/dataflow.developer"         # create, cancel, update Dataflow jobs; view job metrics
  member  = "serviceAccount:${google_service_account.pipeline.email}"
}
```

#### Pub/Sub Publisher

Use when: a service needs to push messages onto a Pub/Sub topic (project-wide grant, prefer topic-level for least privilege).

```hcl
# lets the pipeline SA publish messages to any Pub/Sub topic in the project
resource "google_project_iam_member" "pipeline_pubsub_publisher" {
  project = var.project_id
  role    = "roles/pubsub.publisher"           # publish messages to topics; cannot subscribe or manage topics
  member  = "serviceAccount:${google_service_account.pipeline.email}"
}
```

#### Pub/Sub Subscriber

Use when: a service needs to pull messages from Pub/Sub subscriptions (project-wide grant).

```hcl
# lets the pipeline SA consume messages from any Pub/Sub subscription in the project
resource "google_project_iam_member" "pipeline_pubsub_subscriber" {
  project = var.project_id
  role    = "roles/pubsub.subscriber"          # acknowledge and pull messages; cannot publish or manage topics
  member  = "serviceAccount:${google_service_account.pipeline.email}"
}
```

---

### Resource-Level IAM

Prefer granting IAM at the resource level (secret, bucket, dataset) over project level when the SA only needs access to specific resources — this follows the principle of least privilege.

#### Secret Manager — Grant Secret Access

Use when: a Cloud Run service or pipeline SA needs to read a specific secret at runtime.

```hcl
# grants the pipeline SA permission to read the database password secret
resource "google_secret_manager_secret_iam_member" "pipeline_db_password" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.db_password.secret_id  # the specific secret to grant access to
  role      = "roles/secretmanager.secretAccessor"                 # read the latest version; cannot list, create, or delete
  member    = "serviceAccount:${google_service_account.pipeline.email}"
}
```

#### Service Account — Act As (serviceAccountUser)

Use when: one SA needs to impersonate another SA, e.g., Airflow needs to act as the pipeline SA to submit jobs.

```hcl
# lets Airflow workers impersonate the pipeline SA when submitting jobs
resource "google_service_account_iam_member" "airflow_act_as_pipeline" {
  service_account_id = google_service_account.pipeline.name  # the SA being impersonated
  role               = "roles/iam.serviceAccountUser"        # "act as" permission; required to attach a SA to a resource
  member             = "serviceAccount:${google_service_account.airflow.email}"
}
```

#### GCS Bucket — Grant Bucket Access

Use when: a pipeline SA needs to read/write files in a specific GCS bucket.

```hcl
# grants the pipeline SA read/write access to the raw data GCS bucket
resource "google_storage_bucket_iam_member" "pipeline_raw_bucket" {
  bucket = google_storage_bucket.raw.name      # the specific bucket; not a project-wide grant
  role   = "roles/storage.objectAdmin"         # create, read, overwrite, delete objects; cannot delete the bucket itself
  member = "serviceAccount:${google_service_account.pipeline.email}"
}
```

#### BigQuery Dataset — Grant Dataset Access

Use when: a dashboard SA needs to query tables within a specific dataset without accessing other datasets.

```hcl
# grants the dashboard SA read-only access to the analytics BigQuery dataset
resource "google_bigquery_dataset_iam_member" "dashboard_analytics_dataset" {
  project    = var.project_id
  dataset_id = google_bigquery_dataset.analytics.dataset_id  # scope to this dataset only
  role       = "roles/bigquery.dataViewer"                   # read tables and query data; cannot modify
  member     = "serviceAccount:${google_service_account.dashboard.email}"
}
```

#### Pub/Sub Topic — Grant Publish Permission

Use when: a Cloud Function or external service needs to publish to a specific Pub/Sub topic only.

```hcl
# grants the pipeline SA permission to publish to the events Pub/Sub topic
resource "google_pubsub_topic_iam_member" "pipeline_events_topic" {
  project = var.project_id
  topic   = google_pubsub_topic.events.name   # scope to this topic only; more restrictive than project-level grant
  role    = "roles/pubsub.publisher"          # publish messages to this specific topic
  member  = "serviceAccount:${google_service_account.pipeline.email}"
}
```

---

### Workload Identity Federation (GitHub Actions)

Workload Identity Federation lets GitHub Actions authenticate to GCP without storing long-lived service account keys. The OIDC token from GitHub is exchanged for a short-lived GCP access token.

#### Identity Pool

```hcl
# creates the workload identity pool that GitHub Actions will federate into
resource "google_iam_workload_identity_pool" "github" {
  project                   = var.project_id
  workload_identity_pool_id = "github-pool"    # unique ID within the project; becomes part of the pool resource name
  display_name              = "GitHub Actions" # human-readable label in GCP Console
  description               = "Identity pool for GitHub Actions OIDC federation"
  disabled                  = false            # set true to temporarily block all federation without deleting the pool
}
```

#### Identity Pool Provider (GitHub OIDC)

```hcl
# registers GitHub's OIDC issuer as a trusted identity provider in the pool
resource "google_iam_workload_identity_pool_provider" "github_oidc" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-oidc"   # unique ID for this provider within the pool
  display_name                       = "GitHub OIDC"
  description                        = "GitHub Actions OIDC provider"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"              # maps GitHub's subject claim to GCP's subject
    "attribute.actor"      = "assertion.actor"            # the GitHub user who triggered the workflow
    "attribute.repository" = "assertion.repository"       # org/repo that owns the workflow
  }

  attribute_condition = "assertion.repository == \"${var.github_org}/${var.github_repo}\""  # restrict to your repo only

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"  # GitHub's official OIDC issuer; do not change
  }
}
```

#### Service Account IAM Binding for GitHub Actions

```hcl
# allows GitHub Actions workflows in the specified repo to impersonate the CI/CD SA
resource "google_service_account_iam_member" "github_cicd_wif" {
  service_account_id = google_service_account.cicd.name
  role               = "roles/iam.workloadIdentityUser"  # allows a workload identity to impersonate this SA
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_org}/${var.github_repo}"
  # principalSet matches any identity from the pool whose attribute.repository matches the specified value
}
```

---

## Secret Manager Blocks

### Secret Container

A `google_secret_manager_secret` resource creates the secret container (metadata only). The actual secret value is stored in a separate `google_secret_manager_secret_version` resource. This separation allows rotating values without changing IAM grants.

#### Secret with Auto Replication

Use when: you need a globally replicated secret with Google-managed encryption (most common pattern).

```hcl
# creates the secret container for the database connection password
resource "google_secret_manager_secret" "db_password" {
  project   = var.project_id
  secret_id = "db-password"                   # unique ID within the project; used in API calls and IAM bindings

  labels = {
    environment = var.environment              # e.g. "prod", "staging" — useful for cost attribution
    managed_by  = "terraform"                 # marks this secret as Terraform-managed
  }

  replication {
    auto {}                                   # Google automatically chooses replica locations; simplest option
    # alternative: use user_managed { replicas { location = "us-central1" } } for explicit region control
  }
}
```

#### Secret with User-Managed Replication

Use when: compliance or data residency requirements mandate specific regions.

```hcl
# creates a secret that replicates only to approved regions for data residency compliance
resource "google_secret_manager_secret" "db_password_regional" {
  project   = var.project_id
  secret_id = "db-password-regional"

  replication {
    user_managed {
      replicas {
        location = "us-central1"              # primary replica location
      }
      replicas {
        location = "us-east1"                 # secondary replica for HA; add more for additional redundancy
      }
    }
  }
}
```

---

### Secret Version

The secret version holds the actual plaintext value. Terraform stores this in state — use `sensitive = true` on variables and consider using `ignore_changes` if the value is managed outside Terraform.

```hcl
# stores the actual database password value as a new secret version
resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id  # parent secret container
  secret_data = var.db_password                              # the actual secret value; mark the variable as sensitive

  lifecycle {
    ignore_changes = [secret_data]            # prevent Terraform from replacing the version when the value drifts externally
  }
}
```

---

### Conditional Secret (Datadog Pattern)

Use when: a third-party integration is optional and controlled by a variable. Both the secret container and version use `count` so they are created or destroyed together.

```hcl
# conditionally creates the Datadog API key secret — only when dd_api_key is provided
resource "google_secret_manager_secret" "dd_api_key" {
  count     = var.dd_api_key != "" ? 1 : 0   # create only if the variable is non-empty

  project   = var.project_id
  secret_id = "datadog-api-key"

  labels = {
    managed_by = "terraform"
  }

  replication {
    auto {}
  }
}

# stores the actual Datadog API key value — only created alongside the secret container
resource "google_secret_manager_secret_version" "dd_api_key" {
  count = var.dd_api_key != "" ? 1 : 0       # must match the container's count expression

  secret      = google_secret_manager_secret.dd_api_key[0].id  # [0] because count = 1 produces a list
  secret_data = var.dd_api_key               # the actual Datadog API key string
}
```

---

## Cloud Run Blocks

### Cloud Run Service (Always-On Web App)

Use when: you need a long-running HTTP server that handles concurrent requests — e.g., a REST API, webhook receiver, or internal web app. Cloud Run v2 (`google_cloud_run_v2_service`) is the current recommended resource; it supersedes the older `google_cloud_run_service`.

```hcl
# deploys the main API web service to Cloud Run v2
resource "google_cloud_run_v2_service" "api" {
  project  = var.project_id
  name     = "api-service"                    # service name; must be lowercase letters, digits, hyphens; max 49 chars
  location = var.region                       # GCP region, e.g. "us-central1"

  ingress = "INGRESS_TRAFFIC_ALL"             # options: ALL (public), INTERNAL_ONLY, INTERNAL_AND_CLOUD_LOAD_BALANCING

  labels = {
    environment = var.environment
    managed_by  = "terraform"
  }

  template {
    # --- revision labels & annotations ---
    labels = {
      commit = var.git_sha                    # tag each revision with the git commit that produced it
    }

    # --- service account ---
    service_account = google_service_account.pipeline.email  # SA this revision runs as; determines what GCP APIs it can call

    # --- session affinity ---
    session_affinity = false                  # true = route same client to same instance (stateful); false = any instance (stateless, preferred)

    # --- scaling ---
    scaling {
      min_instance_count = 1                  # keep at least 1 warm instance to avoid cold starts; set 0 to scale to zero
      max_instance_count = 10                 # upper bound on horizontal scale; protects against runaway costs
    }

    # --- execution environment ---
    execution_environment = "EXECUTION_ENVIRONMENT_GEN2"  # gen2 supports full Linux syscalls and longer requests; prefer over gen1

    # --- timeout ---
    timeout = "300s"                          # max request duration; Cloud Run max is 3600s; shorter is safer for APIs

    # --- containers ---
    containers {
      name  = "api"                           # container name within the revision; informational
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${var.artifact_repo}/api:${var.image_tag}"
      # full Artifact Registry image path: <region>-docker.pkg.dev/<project>/<repo>/<image>:<tag>

      # --- resource limits ---
      resources {
        limits = {
          cpu    = "1"                        # vCPU allocation; "1" = 1 vCPU, "2" = 2 vCPUs, "500m" = 0.5 vCPU
          memory = "512Mi"                    # RAM per instance; must be >= 128Mi; scale up if OOM errors appear
        }
        cpu_idle = true                       # true = CPU throttled when not processing requests (saves cost); false = CPU always allocated
        startup_cpu_boost = true              # give extra CPU during container startup to reduce cold start latency
      }

      # --- plain environment variables ---
      env {
        name  = "ENV"
        value = var.environment               # e.g. "prod", "staging"; visible in container as $ENV
      }
      env {
        name  = "PROJECT_ID"
        value = var.project_id               # GCP project ID; useful for clients that construct resource paths at runtime
      }
      env {
        name  = "LOG_LEVEL"
        value = "INFO"                        # application log verbosity; change to "DEBUG" for troubleshooting
      }

      # --- secret-backed environment variables ---
      env {
        name = "DB_PASSWORD"                  # environment variable name visible inside the container
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.db_password.secret_id  # which secret to read
            version = "latest"               # "latest" always uses the newest enabled version; pin to a number for stability
          }
        }
      }

      # --- ports ---
      ports {
        name           = "http1"             # "http1" = HTTP/1.1; "h2c" = HTTP/2 cleartext
        container_port = 8080                # port the application listens on inside the container; Cloud Run always routes to this
      }

      # --- startup probe ---
      startup_probe {
        # fires immediately on startup; if it fails repeatedly, the instance is replaced before traffic is sent to it
        http_get {
          path = "/healthz"                  # your app must return 200 on this path when ready to serve
          port = 8080
        }
        initial_delay_seconds = 5            # wait this many seconds before the first probe attempt
        period_seconds        = 10           # probe every N seconds
        failure_threshold     = 3            # restart container after this many consecutive failures
        timeout_seconds       = 5            # each individual probe must respond within N seconds
      }

      # --- liveness probe ---
      liveness_probe {
        # fires periodically after startup; if it fails, the instance is replaced
        http_get {
          path = "/healthz"
          port = 8080
        }
        period_seconds    = 30
        failure_threshold = 3
        timeout_seconds   = 5
      }
    }

    # --- VPC access ---
    vpc_access {
      connector = var.vpc_connector_id       # Serverless VPC Access connector resource ID; allows Cloud Run to reach private VPC resources
      egress    = "PRIVATE_RANGES_ONLY"      # PRIVATE_RANGES_ONLY = only RFC1918 traffic goes through VPC; ALL_TRAFFIC = all egress through VPC
    }
  }

  # prevent Terraform from destroying and recreating the service when only the image tag changes
  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,       # image updates are handled by CI/CD, not Terraform plan
    ]
  }
}
```

---

### Cloud Run Job (Batch Pipeline)

Use when: you need to run a containerized task to completion — e.g., a nightly ETL job, data export, or model training run. Jobs do not expose an HTTP endpoint; they run to completion and exit.

```hcl
# defines the Cloud Run Job for the nightly batch ETL pipeline
resource "google_cloud_run_v2_job" "etl_pipeline" {
  project  = var.project_id
  name     = "etl-pipeline"                  # job name; shown in GCP Console and used in gcloud run jobs execute
  location = var.region

  labels = {
    environment = var.environment
    managed_by  = "terraform"
  }

  template {
    # --- parallelism and retries ---
    task_count   = 1                          # number of parallel tasks to run; increase for fan-out workloads
    parallelism  = 1                          # max tasks running simultaneously; must be <= task_count

    template {
      # --- timeout ---
      timeout = "3600s"                       # max duration for each task; Cloud Run Jobs max is 24h (86400s)

      # --- retries ---
      max_retries = 3                         # retry a failed task up to N times; use 0 for no retries

      # --- service account ---
      service_account = google_service_account.pipeline.email

      # --- execution environment ---
      execution_environment = "EXECUTION_ENVIRONMENT_GEN2"

      # --- containers ---
      containers {
        name  = "etl"
        image = "${var.region}-docker.pkg.dev/${var.project_id}/${var.artifact_repo}/etl:${var.image_tag}"

        # --- resource limits ---
        resources {
          limits = {
            cpu    = "2"                      # batch jobs can use more CPU than web services
            memory = "2Gi"                    # increase for memory-intensive transforms; watch for OOM kills
          }
        }

        # --- environment variables ---
        env {
          name  = "ENV"
          value = var.environment
        }
        env {
          name  = "BQ_DATASET"
          value = var.bq_dataset              # target BigQuery dataset for the pipeline output
        }
        env {
          name  = "GCS_BUCKET"
          value = var.raw_bucket_name         # source GCS bucket for raw input files
        }

        # --- secret-backed environment variables ---
        env {
          name = "API_SECRET_KEY"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.api_key.secret_id
              version = "latest"
            }
          }
        }

        # --- mounted secret volume (for multi-key JSON credentials) ---
        volume_mounts {
          name       = "credentials"          # must match the volumes block name below
          mount_path = "/secrets"             # path inside the container where the secret file appears
        }
      }

      # --- volumes ---
      volumes {
        name = "credentials"                  # referenced by volume_mounts above
        secret {
          secret = google_secret_manager_secret.sa_key.secret_id  # the secret containing a JSON credentials file
          items {
            version = "latest"
            path    = "credentials.json"      # filename as it appears at /secrets/credentials.json inside the container
          }
        }
      }

      # --- VPC access ---
      vpc_access {
        connector = var.vpc_connector_id
        egress    = "PRIVATE_RANGES_ONLY"
      }
    }
  }
}
```

---

### Cloud Run Job (One-Time Setup / Migration)

Use when: you need to run a database migration or one-time setup script using the same image as the main pipeline but with a different entrypoint.

```hcl
# defines a one-time setup/migration job using the same image as the pipeline job
resource "google_cloud_run_v2_job" "db_migrate" {
  project  = var.project_id
  name     = "db-migrate"
  location = var.region

  labels = {
    environment = var.environment
    managed_by  = "terraform"
    purpose     = "migration"                 # label to distinguish this from regular pipeline jobs
  }

  template {
    task_count = 1
    parallelism = 1

    template {
      timeout     = "600s"                    # migrations should be fast; fail quickly if something is wrong
      max_retries = 0                         # do not retry migrations automatically; manual intervention required on failure

      service_account = google_service_account.pipeline.email

      containers {
        name  = "migrate"
        image = "${var.region}-docker.pkg.dev/${var.project_id}/${var.artifact_repo}/etl:${var.image_tag}"

        # override the default container command to run the migration script
        command = ["/bin/sh"]                 # shell to invoke; use your language's interpreter if needed
        args    = ["-c", "python manage.py migrate --noinput"]  # the actual migration command

        resources {
          limits = {
            cpu    = "1"
            memory = "512Mi"
          }
        }

        env {
          name  = "ENV"
          value = var.environment
        }
        env {
          name = "DB_URL"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.db_url.secret_id
              version = "latest"
            }
          }
        }
      }

      vpc_access {
        connector = var.vpc_connector_id
        egress    = "PRIVATE_RANGES_ONLY"
      }
    }
  }
}
```

---

### Cloud Run IAM — Public Access

Use when: a Cloud Run service should be accessible to anyone on the internet without authentication (e.g., a public API or static site proxy).

```hcl
# makes the Cloud Run service publicly accessible without authentication
resource "google_cloud_run_v2_service_iam_member" "api_public" {
  project  = var.project_id
  location = google_cloud_run_v2_service.api.location
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"              # allows sending requests to this service
  member   = "allUsers"                       # special value meaning "anyone on the internet, no auth required"
}
```

---

### Cloud Run IAM — Authenticated Access (Specific SA)

Use when: only a specific service account (e.g., Cloud Scheduler or another Cloud Run service) should be able to invoke the service.

```hcl
# allows only the Airflow SA to invoke this Cloud Run service (no public access)
resource "google_cloud_run_v2_service_iam_member" "api_airflow_invoker" {
  project  = var.project_id
  location = google_cloud_run_v2_service.api.location
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.airflow.email}"  # only this SA can invoke; all others get 403
}
```

---

## Cloud Functions Blocks

Cloud Functions v2 (`google_cloudfunctions2_function`) uses Cloud Run under the hood. It supports HTTP triggers, Pub/Sub event triggers, and Eventarc-based GCS triggers.

### Cloud Function v2 — HTTP Trigger

Use when: you need a lightweight function invoked by an HTTP request — e.g., a webhook handler or a simple API endpoint that doesn't justify a full Cloud Run service.

```hcl
# deploys a Cloud Function triggered by HTTP requests
resource "google_cloudfunctions2_function" "webhook_handler" {
  project  = var.project_id
  name     = "webhook-handler"               # function name; also the URL path component
  location = var.region

  labels = {
    environment = var.environment
    managed_by  = "terraform"
  }

  # --- source code ---
  build_config {
    runtime     = "python311"                # runtime identifier; see gcloud functions runtimes list for options
    entry_point = "handle_webhook"           # name of the function/method in your source code to invoke
    environment_variables = {
      BUILD_ENV = var.environment            # environment variables available during the build phase only
    }
    source {
      storage_source {
        bucket = google_storage_bucket.function_source.name  # GCS bucket containing the source zip
        object = google_storage_bucket_object.webhook_source.name  # the zip file object in the bucket
      }
    }
  }

  # --- runtime configuration ---
  service_config {
    min_instance_count             = 0       # scale to zero when idle; remove cold starts by setting to 1
    max_instance_count             = 10      # cap scaling; protects against DDoS-induced cost spikes
    available_memory               = "256M"  # RAM per instance; minimum 128M
    available_cpu                  = "1"     # vCPU per instance
    timeout_seconds                = 60      # max execution time per invocation; HTTP functions max 3600s
    service_account_email          = google_service_account.pipeline.email
    ingress_settings               = "ALLOW_ALL"  # ALLOW_ALL = public HTTP; ALLOW_INTERNAL_AND_GCLB = private+LB only
    all_traffic_on_latest_revision = true    # always route 100% of traffic to the latest deployed revision

    environment_variables = {
      ENV        = var.environment
      PROJECT_ID = var.project_id
    }

    secret_environment_variables {
      key        = "API_KEY"                 # env var name inside the function
      project_id = var.project_id
      secret     = google_secret_manager_secret.api_key.secret_id
      version    = "latest"
    }

    vpc_connector                  = var.vpc_connector_id
    vpc_connector_egress_settings  = "PRIVATE_RANGES_ONLY"
  }
}
```

---

### Cloud Function v2 — Pub/Sub Trigger

Use when: you want a function to automatically fire whenever a message is published to a Pub/Sub topic — e.g., for event-driven ETL or notifications.

```hcl
# deploys a Cloud Function triggered by messages on the events Pub/Sub topic
resource "google_cloudfunctions2_function" "pubsub_processor" {
  project  = var.project_id
  name     = "pubsub-processor"
  location = var.region

  build_config {
    runtime     = "python311"
    entry_point = "process_message"          # must accept (event, context) or CloudEvent parameters
    source {
      storage_source {
        bucket = google_storage_bucket.function_source.name
        object = google_storage_bucket_object.processor_source.name
      }
    }
  }

  service_config {
    min_instance_count    = 0
    max_instance_count    = 20               # higher cap for burst Pub/Sub workloads
    available_memory      = "512M"
    timeout_seconds       = 300              # Pub/Sub functions must ack within this window or message is redelivered
    service_account_email = google_service_account.pipeline.email

    environment_variables = {
      ENV = var.environment
    }
  }

  # --- trigger ---
  event_trigger {
    trigger_region = var.region              # must match the function's location
    event_type     = "google.cloud.pubsub.topic.v1.messagePublished"  # CloudEvents type for Pub/Sub; do not change
    pubsub_topic   = google_pubsub_topic.events.id  # the topic that fires this function
    retry_policy   = "RETRY_POLICY_RETRY"   # RETRY = redeliver on function failure; DO_NOT_RETRY = drop failed messages
  }
}
```

---

### Cloud Function v2 — GCS Event Trigger

Use when: you want to trigger a function whenever a new file is uploaded to a GCS bucket — e.g., to process CSV files dropped into a landing bucket.

```hcl
# deploys a Cloud Function triggered by new object uploads in the raw GCS bucket
resource "google_cloudfunctions2_function" "gcs_file_processor" {
  project  = var.project_id
  name     = "gcs-file-processor"
  location = var.region

  build_config {
    runtime     = "python311"
    entry_point = "process_file"             # called with a CloudEvent containing the GCS object metadata
    source {
      storage_source {
        bucket = google_storage_bucket.function_source.name
        object = google_storage_bucket_object.file_processor_source.name
      }
    }
  }

  service_config {
    min_instance_count    = 0
    max_instance_count    = 5
    available_memory      = "1G"             # file processing may need more memory than lightweight functions
    timeout_seconds       = 540             # give enough time to process large files
    service_account_email = google_service_account.pipeline.email

    environment_variables = {
      ENV           = var.environment
      TARGET_DATASET = var.bq_dataset
    }
  }

  # --- GCS event trigger via Eventarc ---
  event_trigger {
    trigger_region        = var.region
    event_type            = "google.cloud.storage.object.v1.finalized"  # fires when an object upload completes
    # other useful types: object.v1.deleted, object.v1.archived, object.v1.metadataUpdated
    retry_policy          = "RETRY_POLICY_RETRY"
    service_account_email = google_service_account.pipeline.email       # SA used by Eventarc to invoke the function

    event_filters {
      attribute = "bucket"                   # filter: only fire for events from this specific bucket
      value     = google_storage_bucket.raw.name
    }
  }
}
```

---

## Cloud Scheduler Blocks

Cloud Scheduler is a fully managed cron job service. Jobs can target HTTP endpoints (including Cloud Run), Pub/Sub topics, or App Engine. Use it to trigger batch pipelines on a schedule.

### Scheduled Job — HTTP Target (Trigger Cloud Run Job)

Use when: you want to execute a Cloud Run Job on a cron schedule — e.g., trigger the nightly ETL at 02:00 UTC.

```hcl
# creates a Cloud Scheduler job that triggers the ETL Cloud Run Job nightly
resource "google_cloud_scheduler_job" "nightly_etl" {
  project     = var.project_id
  name        = "nightly-etl-trigger"        # unique name within the project and region
  region      = var.region
  description = "Triggers the ETL Cloud Run Job every night at 02:00 UTC"
  schedule    = "0 2 * * *"                  # standard cron expression: minute hour day month weekday
  time_zone   = "UTC"                        # always use UTC for scheduled jobs to avoid daylight-saving bugs

  attempt_deadline = "320s"                  # how long to wait for the target to respond before marking the attempt failed

  retry_config {
    retry_count          = 3                 # number of retries if the HTTP call fails; 0 = no retries
    min_backoff_duration = "5s"              # minimum wait between retries
    max_backoff_duration = "3600s"           # maximum wait between retries (exponential backoff cap)
    max_doublings        = 5                 # number of times the backoff interval doubles before hitting max
  }

  http_target {
    http_method = "POST"                     # Cloud Run Jobs execute endpoint requires POST
    uri         = "https://run.googleapis.com/v2/projects/${var.project_id}/locations/${var.region}/jobs/${google_cloud_run_v2_job.etl_pipeline.name}:run"
    # the Cloud Run API endpoint to execute a job run; this creates a new Execution of the job

    oauth_token {
      service_account_email = google_service_account.airflow.email  # SA used to sign the HTTP request; must have run.jobs.run permission
      scope                 = "https://www.googleapis.com/auth/cloud-platform"  # OAuth scope; cloud-platform is appropriate for GCP API calls
    }
  }
}
```

---

### Scheduled Job — Pub/Sub Target

Use when: you want to publish a trigger message to a Pub/Sub topic on a schedule, allowing multiple downstream subscribers to react (fan-out pattern).

```hcl
# creates a Cloud Scheduler job that publishes a trigger message to Pub/Sub
resource "google_cloud_scheduler_job" "hourly_trigger" {
  project     = var.project_id
  name        = "hourly-pipeline-trigger"
  region      = var.region
  description = "Publishes a trigger message to Pub/Sub every hour"
  schedule    = "0 * * * *"                  # every hour at minute 0
  time_zone   = "UTC"

  retry_config {
    retry_count = 3
  }

  pubsub_target {
    topic_name = google_pubsub_topic.pipeline_trigger.id  # full topic resource name; Scheduler will publish here
    data       = base64encode(jsonencode({                 # message body must be base64-encoded
      trigger = "hourly"                                   # the payload your function/subscriber reads to know what to do
      source  = "cloud-scheduler"
    }))
    attributes = {
      environment = var.environment          # optional message attributes; visible alongside the message body
    }
  }
}
```

---

## Pub/Sub Blocks

### Topic

A Pub/Sub topic is the channel through which messages are published. Subscribers attach subscriptions to pull or receive messages. Create one topic per logical event stream.

#### Topic with Message Retention

Use when: you need messages to be retained for replay even if no subscription reads them immediately — useful during incidents or backfills.

```hcl
# creates the events Pub/Sub topic with message retention for replay capability
resource "google_pubsub_topic" "events" {
  project = var.project_id
  name    = "data-events"                    # topic name; becomes projects/<project>/topics/data-events

  labels = {
    environment = var.environment
    managed_by  = "terraform"
  }

  message_retention_duration = "604800s"     # retain messages for 7 days (604800s); default is 0 (no retention beyond subscription ack deadline)
  # message_storage_policy controls which regions can store messages; omit for default Google-managed placement

  schema_settings {
    schema   = google_pubsub_schema.events.id  # reference to a schema resource; enforces message structure
    encoding = "JSON"                          # JSON or BINARY; JSON is human-readable; BINARY is more efficient for Avro/Protobuf
  }
}
```

#### Topic without Schema (simple)

```hcl
# creates a simple trigger topic without schema enforcement
resource "google_pubsub_topic" "pipeline_trigger" {
  project = var.project_id
  name    = "pipeline-trigger"

  labels = {
    environment = var.environment
    managed_by  = "terraform"
  }

  message_retention_duration = "86400s"      # retain for 1 day; triggers are short-lived and don't need long retention
}
```

---

### Pull Subscription with Dead Letter and Retry Policy

Use when: a pipeline service pulls messages from a topic and you need robust error handling — undeliverable messages go to a dead letter topic for inspection.

```hcl
# creates a pull subscription for the pipeline to consume events
resource "google_pubsub_subscription" "events_pull" {
  project = var.project_id
  name    = "data-events-pipeline-sub"       # subscription name; must be unique within the project
  topic   = google_pubsub_topic.events.id    # the topic this subscription reads from

  labels = {
    environment = var.environment
    managed_by  = "terraform"
  }

  # --- message handling ---
  ack_deadline_seconds       = 60            # subscriber must ack within N seconds or the message is redelivered; max 600
  message_retention_duration = "604800s"     # how long to retain unacked messages; max 7 days
  retain_acked_messages      = false         # true = keep messages after ack (useful for replay); false = delete after ack

  # --- expiration ---
  expiration_policy {
    ttl = "2678400s"                         # delete the subscription if inactive for 31 days; set "" to never expire
  }

  # --- retry policy ---
  retry_policy {
    minimum_backoff = "10s"                  # wait at least this long before redelivering a failed message
    maximum_backoff = "600s"                 # cap the backoff at this duration (exponential backoff)
  }

  # --- dead letter policy ---
  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.events_deadletter.id  # messages that exceed max_delivery_attempts go here
    max_delivery_attempts = 5               # attempt delivery this many times before routing to dead letter; min 5
  }

  # --- filter (optional) ---
  # filter = "attributes.environment=\"prod\""  # only receive messages with this attribute; omit to receive all messages

  enable_exactly_once_delivery = false       # true = at-most-once semantics (requires ack extensions); false = at-least-once (default, simpler)
}

# dead letter topic to capture undeliverable messages
resource "google_pubsub_topic" "events_deadletter" {
  project = var.project_id
  name    = "data-events-deadletter"         # naming convention: <original-topic>-deadletter

  labels = {
    environment = var.environment
    managed_by  = "terraform"
  }
}

# Cloud Pub/Sub needs permission to forward messages to the dead letter topic
resource "google_pubsub_topic_iam_member" "deadletter_publisher" {
  project = var.project_id
  topic   = google_pubsub_topic.events_deadletter.name
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
  # the Pub/Sub service agent SA; its format is fixed: service-<project_number>@gcp-sa-pubsub.iam.gserviceaccount.com
}

# Cloud Pub/Sub also needs permission to acknowledge messages in the source subscription on behalf of the subscriber
resource "google_pubsub_subscription_iam_member" "deadletter_subscriber" {
  project      = var.project_id
  subscription = google_pubsub_subscription.events_pull.name
  role         = "roles/pubsub.subscriber"
  member       = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}
```

---

### Push Subscription (to Cloud Run Endpoint)

Use when: you want Pub/Sub to deliver messages by pushing HTTP POST requests directly to a Cloud Run service — simpler than running a pull loop.

```hcl
# creates a push subscription that delivers messages to the Cloud Run webhook handler
resource "google_pubsub_subscription" "events_push" {
  project = var.project_id
  name    = "data-events-push-sub"
  topic   = google_pubsub_topic.events.id

  labels = {
    environment = var.environment
    managed_by  = "terraform"
  }

  ack_deadline_seconds = 60                  # Pub/Sub will retry if the Cloud Run endpoint doesn't respond with 200 within this window

  push_config {
    push_endpoint = "${google_cloud_run_v2_service.api.uri}/pubsub/events"  # full HTTPS URL including path

    oidc_token {
      service_account_email = google_service_account.pipeline.email  # SA whose identity is used to authenticate the push request
      audience              = google_cloud_run_v2_service.api.uri    # must match the Cloud Run service URL for token validation
    }

    # wrap the Pub/Sub message in a standardized CloudEvents envelope
    no_wrapper {
      write_metadata = false                 # false = wrap message in standard Pub/Sub JSON envelope; true = raw message body only
    }
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "300s"                 # push subscriptions back off before retrying failed deliveries
  }

  expiration_policy {
    ttl = ""                                 # empty string = never expire; push subscriptions are usually permanent
  }
}
```

---

### Pub/Sub Schema

Use when: you need to enforce a consistent message structure across all publishers — prevents malformed messages from reaching subscribers and breaking pipelines.

#### Avro Schema

```hcl
# defines an Avro schema for the events topic to enforce message structure
resource "google_pubsub_schema" "events" {
  project    = var.project_id
  name       = "data-events-schema"          # schema name; referenced by topic's schema_settings block
  type       = "AVRO"                        # AVRO or PROTOCOL_BUFFER; Avro is more common in data engineering

  definition = jsonencode({                  # Avro schema definition as a JSON string
    type      = "record"                     # "record" = a named object with fields
    name      = "DataEvent"                  # Avro record name; used in code-generated classes
    namespace = "com.example.events"         # package/namespace for generated code; convention: reverse domain
    fields = [
      {
        name    = "event_id"
        type    = "string"                   # required string field; no default means it must be present
        doc     = "Unique identifier for this event (UUID)"
      },
      {
        name    = "event_type"
        type    = "string"
        doc     = "Category of event, e.g. 'user.signup', 'order.created'"
      },
      {
        name    = "timestamp"
        type    = "long"
        logicalType = "timestamp-millis"     # Avro logical type: milliseconds since epoch
        doc     = "Event timestamp in milliseconds since Unix epoch"
      },
      {
        name    = "payload"
        type    = ["null", "string"]         # union type: null or string; "null" first = optional field
        default = null
        doc     = "Optional JSON payload for event-specific data"
      }
    ]
  })
}
```

#### Protobuf Schema

```hcl
# defines a Protobuf schema for the events topic
resource "google_pubsub_schema" "events_proto" {
  project = var.project_id
  name    = "data-events-proto-schema"
  type    = "PROTOCOL_BUFFER"                # use Protobuf when performance and binary encoding are priorities

  definition = <<-PROTO
    syntax = "proto3";
    // DataEvent represents a single event published to the events topic
    message DataEvent {
      string event_id   = 1;                 // unique event identifier (UUID)
      string event_type = 2;                 // event category, e.g. "user.signup"
      int64  timestamp  = 3;                 // milliseconds since Unix epoch
      string payload    = 4;                 // optional JSON payload; empty string if not set
    }
  PROTO
  # proto3 syntax is recommended; field numbers (1, 2, 3) must never change once published to maintain backward compatibility
}
```

---

## Artifact Registry Blocks

### Docker Registry with Cleanup Policies

Use when: you store Docker images for Cloud Run or Cloud Functions and want to automatically remove old or untagged images to control storage costs.

```hcl
# creates a Docker image repository in Artifact Registry with cleanup policies
resource "google_artifact_registry_repository" "docker" {
  project       = var.project_id
  location      = var.region                 # images are stored in this region; co-locate with Cloud Run for faster pulls
  repository_id = "docker-images"            # unique ID within the project and location; becomes part of the image path
  format        = "DOCKER"                   # DOCKER, MAVEN, NPM, PYTHON, APT, YUM, etc.
  description   = "Docker images for Cloud Run services and Cloud Functions"

  labels = {
    environment = var.environment
    managed_by  = "terraform"
  }

  # --- immutable tags ---
  # Uncomment to prevent overwriting existing tags — good for production registries
  # docker_config {
  #   immutable_tags = true                  # once pushed, a tag cannot be reassigned to a different image digest
  # }

  # --- cleanup policies ---
  cleanup_policy_dry_run = false             # true = log what would be deleted without actually deleting; set true when first deploying

  cleanup_policies {
    id     = "keep-latest-5"                 # arbitrary ID for this policy; must be unique within the repository
    action = "KEEP"                          # KEEP = retain matching images; DELETE = remove matching images

    most_recent_versions {
      # keep the 5 most recent tagged versions of each image
      keep_count            = 5             # number of recent versions to retain per image name
      package_name_prefixes = []            # empty = apply to all image names; specify prefixes to scope this policy
    }
  }

  cleanup_policies {
    id     = "delete-untagged"
    action = "DELETE"                        # remove images that match this policy

    condition {
      tag_state = "UNTAGGED"                # UNTAGGED = images with no tags (dangling layers from CI builds)
      # older_than = "604800s"              # optionally add an age filter: only delete untagged images older than 7 days
    }
  }

  cleanup_policies {
    id     = "delete-old-tagged"
    action = "DELETE"

    condition {
      tag_state    = "TAGGED"               # target tagged images (not untagged)
      older_than   = "7776000s"             # delete tagged images older than 90 days (7776000s)
      tag_prefixes = ["dev-", "pr-"]        # only delete images with these tag prefixes; protects "latest", "v1.2.3" etc.
    }
  }
}
```

---

### Variables Reference

These variables are referenced across the blocks above. Adapt types and defaults to your project.

```hcl
# --- project and environment ---
variable "project_id" {
  type        = string
  description = "GCP project ID where all resources are created"
}

variable "environment" {
  type        = string
  description = "Deployment environment: prod, staging, or dev"
  validation {
    condition     = contains(["prod", "staging", "dev"], var.environment)
    error_message = "environment must be one of: prod, staging, dev"
  }
}

variable "region" {
  type        = string
  description = "GCP region for regional resources, e.g. us-central1"
  default     = "us-central1"
}

# --- networking ---
variable "vpc_connector_id" {
  type        = string
  description = "Serverless VPC Access connector ID for Cloud Run / Cloud Functions private VPC access"
}

# --- artifact registry ---
variable "artifact_repo" {
  type        = string
  description = "Artifact Registry repository ID where Docker images are stored"
  default     = "docker-images"
}

variable "image_tag" {
  type        = string
  description = "Docker image tag to deploy; typically the git SHA or semantic version"
}

# --- secrets ---
variable "db_password" {
  type        = string
  description = "Database password to store in Secret Manager"
  sensitive   = true                         # marks the value as sensitive; Terraform will redact it in plan output and logs
}

# --- integrations ---
variable "dd_enabled" {
  type        = bool
  description = "Set true to create Datadog integration resources (SA, secrets, IAM)"
  default     = false
}

variable "dd_api_key" {
  type        = string
  description = "Datadog API key; leave empty to skip Datadog secret creation"
  sensitive   = true
  default     = ""
}

# --- GitHub Actions WIF ---
variable "github_org" {
  type        = string
  description = "GitHub organisation name for Workload Identity Federation attribute condition"
}

variable "github_repo" {
  type        = string
  description = "GitHub repository name (without org prefix) for WIF attribute condition"
}

# --- BigQuery ---
variable "bq_dataset" {
  type        = string
  description = "BigQuery dataset ID used as the pipeline output target"
}

# --- GCS ---
variable "raw_bucket_name" {
  type        = string
  description = "Name of the GCS bucket used as the raw data landing zone"
}

# --- git ---
variable "git_sha" {
  type        = string
  description = "Short git commit SHA; used to label Cloud Run revisions for traceability"
  default     = "unknown"
}
```

---

### Data Sources

```hcl
# fetches the current project metadata — used to get the project number for Pub/Sub service agent SA
data "google_project" "current" {
  project_id = var.project_id               # returns project metadata including project_number
}

# fetches the default Compute Engine SA (useful to reference or restrict it)
data "google_compute_default_service_account" "default" {
  project = var.project_id
}
```

---

## Common Patterns

### Count Toggle Pattern

The `count` meta-argument is the standard way to conditionally create a resource in Terraform. Use it when a resource is optional and controlled by a variable.

```hcl
# pattern: create a resource only when a variable is set
resource "google_service_account" "optional_sa" {
  count = var.feature_enabled ? 1 : 0       # ternary: 1 = create, 0 = skip

  account_id = "optional-sa"
  project    = var.project_id
}

# reference count-controlled resources with [0] index
resource "google_project_iam_member" "optional_sa_role" {
  count = var.feature_enabled ? 1 : 0       # match the count of the resource it references

  project = var.project_id
  role    = "roles/viewer"
  member  = "serviceAccount:${google_service_account.optional_sa[0].email}"
  # [0] is required because count = 1 returns a list, not a single object
}
```

### Ignore Changes Pattern

Use `ignore_changes` when a field is updated outside Terraform (e.g., by CI/CD) and you don't want Terraform to drift-correct it on the next plan.

```hcl
resource "google_cloud_run_v2_service" "api" {
  # ... (other arguments)

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,       # CI/CD deploys new image tags; Terraform should not revert them
      template[0].labels,                    # revision labels may be set by deployment tooling
    ]
  }
}
```

### For Each Pattern (Multiple SAs)

Use `for_each` when you need to create multiple instances of the same resource type with different configurations.

```hcl
# creates one service account per pipeline defined in the map
variable "pipelines" {
  type = map(object({
    display_name = string
    description  = string
  }))
  default = {
    etl      = { display_name = "ETL Pipeline",     description = "Nightly batch ETL" }
    streaming = { display_name = "Streaming Pipeline", description = "Real-time event ingestion" }
    ml        = { display_name = "ML Pipeline",     description = "Model training and scoring" }
  }
}

resource "google_service_account" "pipelines" {
  for_each = var.pipelines                   # one SA per map entry

  account_id   = "${each.key}-pipeline"      # e.g. "etl-pipeline", "streaming-pipeline"
  display_name = each.value.display_name
  description  = each.value.description
  project      = var.project_id
}

# grant the same role to all pipeline SAs
resource "google_project_iam_member" "pipelines_bq_job_user" {
  for_each = var.pipelines

  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${google_service_account.pipelines[each.key].email}"
}
```
