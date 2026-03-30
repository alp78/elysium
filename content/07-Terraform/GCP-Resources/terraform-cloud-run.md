---
type: reference
category: infrastructure
technology: [terraform, gcp]
tags: [infrastructure, terraform, iac, gcp]
aliases: [terraform Cloud Run, google_cloud_run_v2_service, google_cloud_run_v2_job, Cloud Run service terraform, Cloud Run job terraform]
keywords: [Cloud Run, google_cloud_run_v2_service, google_cloud_run_v2_job, Cloud Run job, Cloud Run service, session affinity, direct VPC egress, startup probe, secret injection, task_count, max_retries, timeout, scaling, min_instances, PRIVATE_RANGES_ONLY]
description: "Terraform configuration for Cloud Run services (long-running HTTP endpoints) and Cloud Run jobs (batch run-to-completion), including VPC access, secret injection, session affinity, scaling, and the double-nested job template structure."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Terraform Cloud Run — Services and Jobs

This note covers `run.tf` — the Cloud Run service (dashboard) and Cloud Run jobs (pipeline, setup) that form the application layer of the example infrastructure.

### Cloud Run Billing Note

> [!info] Billing Is Usage-Based
>
> Billing: Actual Usage, Not Limits.
> Cloud Run bills **actual CPU/memory usage**, not the limits defined in the configuration. Setting `cpu = "2"` and `memory = "2Gi"` as limits does not mean you pay for 2 CPUs — you pay for what the container actually consumes during execution. Lowering limits does not save cost; it only risks OOM kills or CPU throttling if the workload exceeds them.

### Locals Block

```hcl
locals {
  registry = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.data-pipeline.repository_id}"
  sql_ip   = google_compute_instance.sql.network_interface[0].network_ip
  sql_user = "sa"
}
```

**`locals`** are computed values reused across the file. They are evaluated once and cannot be overridden from outside.

| Local | Value | Purpose |
|-------|-------|---------|
| `registry` | `europe-west1-docker.pkg.dev/data-platform-prod/data-pipeline` | Full registry path. Used as prefix for image references. |
| `sql_ip` | `10.0.0.x` (resolved at apply time) | The SQL VM's **private IP**. Read from the VM's first network interface. Used in connection strings. |
| `sql_user` | `sa` | SQL Server system administrator username. |

---

## Resource: Dashboard Service

A Cloud Run **service** is a long-running HTTP endpoint. Unlike jobs, services stay alive to serve requests. For the architectural distinction between services and jobs, including when to choose each, see [cloud-run-jobs-vs-services](https://alp78.github.io/elysium/06-GCP/Serverless/cloud-run-jobs-vs-services).

```hcl
resource "google_cloud_run_v2_service" "dashboard" {
  name                = "data-pipeline-dashboard"
  location            = var.region
  deletion_protection = false
  ...
}
```

| Field | Value | Meaning |
|-------|-------|---------|
| `name` | `data-pipeline-dashboard` | Service name. The public URL is derived from this: `data-pipeline-dashboard-xxxxx-ew.a.run.app`. |
| `deletion_protection` | `false` | When `true`, Terraform refuses to destroy this resource. Set to `false` here to allow teardown via `terraform destroy`. In production, consider `true` for databases. |

### Template Block

```hcl
template {
  session_affinity = true
  service_account  = google_service_account.dashboard.email
  timeout          = "3600s"

  scaling {
    min_instance_count = 1
    max_instance_count = 2
  }
  ...
}
```

| Field | Value | Meaning |
|-------|-------|---------|
| `session_affinity` | `true` | **Sticky sessions** — routes requests from the same client to the same container instance. Critical for Blazor Server, which maintains a persistent WebSocket (SignalR circuit) per user. Without this, WebSocket connections would break when routed to a different instance. |
| `service_account` | `data-pipeline-dashboard@...` | The identity the container runs as. Determines what GCP APIs it can call. |
| `timeout` | `3600s` | Maximum request duration (1 hour). Blazor's WebSocket connections are long-lived — the default 300s would disconnect users after 5 minutes. |
| `min_instance_count` | `1` | **Always-warm** — at least one instance is always running. Eliminates cold start latency (which would break WebSocket connections). Costs ~$5-10/month for an idle instance. |
| `max_instance_count` | `2` | Limits scaling to 2 instances. This dashboard serves a small number of users — no need for aggressive autoscaling. |

### Container Block — Dashboard

```hcl
containers {
  image = "${local.registry}/dashboard:latest"

  ports {
    container_port = 8080
  }

  startup_probe {
    http_get { path = "/" }
    initial_delay_seconds = 3
    period_seconds        = 10
    failure_threshold     = 3
  }

  env {
    name  = "ConnectionStrings__project"
    value = "Server=${local.sql_ip},1433;Database=data-pipeline;User Id=${local.sql_user};TrustServerCertificate=true"
  }

  env {
    name = "DB_PASSWORD"
    value_source {
      secret_key_ref {
        secret  = google_secret_manager_secret.db_password.secret_id
        version = "latest"
      }
    }
  }

  resources {
    limits = {
      cpu    = "1"
      memory = "512Mi"
    }
  }
}
```

| Field | Value | Meaning |
|-------|-------|---------|
| `image` | `.../dashboard:latest` | Docker image to run. `latest` tag is updated by [GitHub Actions](https://alp78.github.io/elysium/10-GitHub-Actions/github-actions-workflows) on every push to `main`. |
| `container_port` | `8080` | Port the Blazor app listens on inside the container. Cloud Run routes external HTTPS traffic to this port. |
| `startup_probe` | HTTP GET `/` | Cloud Run checks if the container is ready by hitting `/` every 10 seconds, starting 3 seconds after launch. If it fails 3 times, the container is killed and restarted. |
| `ConnectionStrings__project` | ADO.NET connection string (without password) | .NET convention: double underscore `__` maps to `:` in `appsettings.json` hierarchy. Equivalent to `ConnectionStrings:data-pipeline`. Contains the SQL VM's private IP, database name, and user — but **not** the password. `TrustServerCertificate=true` skips SSL certificate validation (acceptable for internal VPC traffic). |
| `DB_PASSWORD` | Secret Manager ref | The database password is injected from Secret Manager at container startup. `Program.cs` reads this env var and merges it into the connection string via `SqlConnectionStringBuilder`. The password never appears in Terraform state or Cloud Run configuration. |
| `cpu` | `1` | 1 vCPU allocated to the container. |
| `memory` | `512Mi` | 512 megabytes of RAM. Sufficient for Blazor Server with a small number of concurrent circuits. |

### VPC Access — Direct Egress

```hcl
vpc_access {
  network_interfaces {
    network    = google_compute_network.main.id
    subnetwork = google_compute_subnetwork.main.id
  }
  egress = "PRIVATE_RANGES_ONLY"
}
```

| Field | Value | Meaning |
|-------|-------|---------|
| `network_interfaces` | VPC + subnet | **Direct VPC egress** — Cloud Run gets a network interface in the VPC, allowing it to reach private IPs (like the SQL VM at `10.0.0.x`). This replaced the older VPC Connector approach. |
| `egress` | `PRIVATE_RANGES_ONLY` | Only traffic destined for private IP ranges (RFC 1918: `10.x`, `172.16-31.x`, `192.168.x`) goes through the VPC. Public internet traffic (e.g., external API calls) uses Cloud Run's default route. This prevents database traffic from ever touching the public internet. |

### Public Access IAM

```hcl
resource "google_cloud_run_v2_service_iam_member" "dashboard_public" {
  name     = google_cloud_run_v2_service.dashboard.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}
```

| Field | Value | Meaning |
|-------|-------|---------|
| `member` | `allUsers` | A special IAM principal meaning "anyone on the internet." This makes the dashboard publicly accessible without authentication. Without this binding, Cloud Run returns 403 to unauthenticated requests. |

---

## Resource: Pipeline Job

A Cloud Run **job** runs a container to completion and exits. Unlike a service, it has no HTTP endpoint — it is triggered externally (by Airflow).

```hcl
resource "google_cloud_run_v2_job" "pipeline" {
  name                = "data-pipeline-pipeline"
  location            = var.region
  deletion_protection = false
  ...
}
```

### Service vs Job Comparison

| Aspect | Dashboard (service) | Pipeline (job) |
|--------|-------------------|----------------|
| **Type** | Always-running HTTP service | Run-to-completion batch job |
| **Trigger** | Incoming HTTP requests | Airflow `CloudRunExecuteJobOperator` |
| **Scaling** | 1-2 instances | 1 task per execution |
| **Timeout** | 3600s | 1800s (30 min) |
| **Retries** | N/A (auto-restarts) | `max_retries = 1` |
| **CPU/Memory** | 1 CPU, 512Mi | 2 CPUs, 2Gi |

### Double-Nested Template

Cloud Run jobs have **two nested template levels** — this is not a typo:

```hcl
template {            # ← execution template (how many tasks)
  task_count = 1

  template {          # ← task template (what each container looks like)
    service_account = google_service_account.pipeline.email
    timeout         = "1800s"
    max_retries     = 1
    ...
  }
}
```

The **outer template** (execution template) controls how many parallel tasks to run. The **inner template** (task template) defines the container spec, service account, timeout, and retries. This structure exists because Cloud Run jobs support fan-out: if `task_count = 10`, it would spawn 10 identical containers in parallel. Each container receives a `CLOUD_RUN_TASK_INDEX` env var (0-9) to know which shard of work to handle.

| Field | Value | Meaning |
|-------|-------|---------|
| `task_count` | `1` | Number of parallel tasks per execution. Set to 1 because the pipeline handles all indices sequentially within a single process. |
| `timeout` | `1800s` | Maximum runtime (30 minutes). The full pipeline typically completes in 2-5 minutes. The generous timeout accommodates slow API responses or large backfills. |
| `max_retries` | `1` | If the container exits with a non-zero code, Cloud Run retries once. Handles transient failures (network blips, OOM). The pipeline is idempotent, so retrying is always safe. |

### Pipeline Job Environment Variables

```hcl
env {
  name = "SA_PASSWORD"
  value_source {
    secret_key_ref {
      secret  = google_secret_manager_secret.db_password.secret_id
      version = "latest"
    }
  }
}
```

| Field | Value | Meaning |
|-------|-------|---------|
| `value_source.secret_key_ref` | — | **Secret injection** — Cloud Run reads the secret from Secret Manager at container startup and injects it as an environment variable. The container never sees the secret in its configuration — only at runtime in memory. |
| `version` | `latest` | Always use the most recent version of the secret. Alternatively, you can pin to a specific version number for stability. |

Other pipeline environment variables:

| Variable | Value | Purpose |
|----------|-------|---------|
| `SQL_HOST` | `local.sql_ip` | SQL VM's private IP |
| `SQL_PORT` | `1433` | SQL Server port |
| `SQL_DATABASE` | `data-pipeline` | Database name |
| `SQL_USER` | `sa` | SQL Server admin |
| `DD_SERVICE` | `data-pipeline-pipeline` | Datadog service name for APM traces |
| `DD_ENV` | `prod` | Datadog environment tag |
| `DD_TRACE_AGENT_URL` | `http://<airflow-ip>:8126` | APM trace endpoint on Airflow VM |
| `DD_API_KEY` | *(from Secret Manager)* | Datadog API key for direct log shipping |
| `LOG_FORMAT` | `json` | Structured JSON logs for Datadog parsing |

---

### Resource: Setup Job

```hcl
resource "google_cloud_run_v2_job" "setup" {
  ...
  template {
    template {
      ...
      containers {
        image   = "${local.registry}/pipeline:latest"
        command = ["bash", "-c", "python db/run_ddl.py && python utils/setup_index.py"]
      }
      ...
      max_retries = 0
      timeout     = "3600s"
    }
  }
}
```

| Field | Value | Meaning |
|-------|-------|---------|
| `image` | `.../pipeline:latest` | Uses the same image as the pipeline job — the setup scripts are bundled in the same container. |
| `command` | `["bash", "-c", "python db/run_ddl.py && python utils/setup_index.py"]` | **Entrypoint override** — runs DDL scripts (create schemas/tables) then sets up all indices (fetch dimensions, seed history). `&&` ensures the second command only runs if the first succeeds. |
| `max_retries` | `0` | No automatic retries. Setup is a one-time operation — if it fails, investigate the logs rather than blindly retrying. |
| `timeout` | `3600s` | 1 hour. Initial setup includes downloading historical data for all configured instruments — this can take 10-15 minutes. |

---

### gcloud Verification Commands

```bash
# List all Cloud Run services
gcloud run services list --region=europe-west1

# Describe the dashboard service (shows URL, env vars, scaling, revision)
gcloud run services describe data-pipeline-dashboard --region=europe-west1

# List all Cloud Run jobs
gcloud run jobs list --region=europe-west1

# Describe a job (shows env vars, timeout, retries, service account)
gcloud run jobs describe data-pipeline-pipeline --region=europe-west1
gcloud run jobs describe data-pipeline-setup --region=europe-west1

# View recent job executions
gcloud run jobs executions list --job=data-pipeline-pipeline --region=europe-west1

# Manually trigger a job
gcloud run jobs execute data-pipeline-pipeline --region=europe-west1
gcloud run jobs execute data-pipeline-setup --region=europe-west1

# View logs for a Cloud Run service or job
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=data-pipeline-dashboard" --limit=50 --format="table(timestamp, textPayload)"
gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=data-pipeline-pipeline" --limit=50 --format="table(timestamp, textPayload)"
```

## Related

- [terraform-iam-and-secrets](https://alp78.github.io/elysium/07-Terraform/GCP-Resources/terraform-iam-and-secrets) — service accounts and Secret Manager used here
- [terraform-networking](https://alp78.github.io/elysium/07-Terraform/GCP-Resources/terraform-networking) — the VPC this service connects to via direct egress
- [terraform-registry-and-ci](https://alp78.github.io/elysium/07-Terraform/GCP-Resources/terraform-registry-and-ci) — Artifact Registry where the Docker images live
- [terraform-compute](https://alp78.github.io/elysium/07-Terraform/GCP-Resources/terraform-compute) — the SQL VM that these services connect to

## References

- [google_cloud_run_v2_service](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/cloud_run_v2_service)
- [google_cloud_run_v2_job](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/cloud_run_v2_job)
- [Cloud Run direct VPC egress](https://cloud.google.com/run/docs/configuring/vpc-direct-vpc)
- [Secret Manager integration with Cloud Run](https://cloud.google.com/run/docs/configuring/secrets)
