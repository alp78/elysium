---
type: concept
category: gcp
technology: [gcp, cloud-run]
tags: [infrastructure, gcp, cloud-run]
aliases: [Cloud Run Jobs, Cloud Run Services, gcloud run jobs, serverless containers, Cloud Run ETL, cold start]
keywords: [cloud run, cloud run jobs, cloud run services, serverless, containers, docker, execute job, cold start, ETL batch job, pipeline stage, gcloud run jobs execute, gcloud run jobs update, memory, CPU, timeout, retries, image size, multi-stage build, min instances]
description: "How to manage Cloud Run Jobs vs Services for data pipeline workloads — executing jobs, viewing logs, updating configuration, and mitigating cold start latency for ETL containers."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Cloud Run Jobs vs Services — Serverless Containers for Data Pipelines

> [!quote]
> "Functions are the verbs of serverless; containers are the nouns. You need both parts of speech to write a complete sentence."
>
> — **Ben Kehoe**, iRobot cloud robotics engineer

Cloud Run runs Docker containers without managing servers. For data engineering, Cloud Run **Jobs** are the key feature — they run to completion and exit (unlike Cloud Run **Services** which serve HTTP requests). Your pipeline stages (loaders, transforms, scorers) each run as a Cloud Run Job, triggered by Airflow or a scheduler. For infrastructure-as-code deployment, [terraform-cloud-run](https://alp78.github.io/elysium/07-Terraform/GCP-Resources/terraform-cloud-run) provides the Terraform resource definitions. Services are used for APIs, webhooks, and event-driven endpoints that need to stay running.

### Cloud Run Jobs vs Services Comparison

| Feature | Cloud Run Service | Cloud Run Job |
|---|---|---|
| Lifecycle | Runs continuously, serves HTTP | Runs to completion, then exits |
| Trigger | HTTP request | Manual, scheduler, Airflow |
| Scaling | 0 to N instances based on traffic | Fixed task count |
| Timeout | 60 min max | 24 hours max |
| Use case | APIs, webhooks, dashboards | ETL stages, data processing, batch jobs |

### Listing and Executing Cloud Run Jobs

```bash
# List jobs
gcloud run jobs list --region=europe-west1

# Execute a job (trigger a pipeline stage)
gcloud run jobs execute data-pipeline-pipeline --region=europe-west1
# Creates a new execution — the container starts, runs, and exits

# Execute with argument overrides
gcloud run jobs execute data-pipeline-pipeline --region=europe-west1 \
  --args="--stage,gold,--index,market_index"
# --args = comma-separated arguments passed to the container's ENTRYPOINT
# Use case: run a specific stage for a specific index (instead of the full pipeline)
```

### Monitoring Cloud Run Job Executions

```bash
# View recent executions
gcloud run jobs executions list --job=data-pipeline-pipeline --region=europe-west1 --limit=5
# Shows: execution name, status (Succeeded/Failed), creation time

# View execution logs
gcloud run jobs executions logs <execution-name> --region=europe-west1
```

### Updating Cloud Run Job Configuration

`--memory` sets the RAM limit (128Mi to 32Gi), `--cpu` sets CPU allocation (0.08 to 8), `--task-timeout` is the max execution time before a forced kill, and `--max-retries` controls automatic retry on failure (0 = no retry).

```bash
# Update a job (change image, resources, environment)
gcloud run jobs update data-pipeline-pipeline --region=europe-west1 \
  --image=europe-west1-docker.pkg.dev/data-platform-prod/data-pipeline/data-pipeline:latest \
  --memory=2Gi --cpu=1 \
  --task-timeout=30m \
  --set-env-vars="DB_HOST=10.132.0.2,DB_NAME=data-pipeline,LOG_LEVEL=INFO" \
  --max-retries=1
```

### Cloud Run Cold Start Mitigation

The first execution after a period of inactivity takes longer because Cloud Run needs to pull and start the container image. For data pipelines triggered 3x/day, cold starts are a minor annoyance. Mitigation strategies:

> [!tip] Reducing Cold Start Latency
>
> - **Keep images small.** A 2 GB image with unnecessary dependencies takes 30-60 seconds to pull. A 200 MB slim image starts in 5-10 seconds. Use [docker-compose](https://alp78.github.io/elysium/09-Docker/docker-compose) locally to mirror the production container environment during development.
> - **Multi-stage Docker builds.** Build dependencies in stage 1, copy only the runtime into the final image.
> - **Min instances = 1** (for services): keeps one instance warm. Not applicable to Jobs (they always cold start).
> - **CPU allocation = always** (for services): keeps CPU allocated even between requests, reducing startup latency.

### Cloud Run Pipeline Architecture Pattern

```text
Airflow DAG
    │
    ├─► gcloud run jobs execute data-pipeline-pipeline --args="--stage,bronze"
    │       └─► Cloud Run Job (bronze container) → writes to GCS
    │
    ├─► gcloud run jobs execute data-pipeline-pipeline --args="--stage,silver"
    │       └─► Cloud Run Job (silver container) → reads GCS, writes BigQuery staging
    │
    └─► gcloud run jobs execute data-pipeline-pipeline --args="--stage,gold"
            └─► Cloud Run Job (gold container) → MERGE into BigQuery production
```

Each stage is an independent Cloud Run Job. Airflow orchestrates the sequence using task dependencies. This architecture allows individual stages to be retried, redeployed, or replaced without affecting the others. For CI/CD automation that builds and deploys these containers via Workload Identity, see [github-actions-ci-cd](https://alp78.github.io/elysium/10-GitHub-Actions/github-actions-ci-cd).

### Cloud Run Environment Variables and Secrets

Pass configuration via environment variables. For sensitive values (database passwords, API keys), reference Secret Manager instead of hardcoding in `--set-env-vars`:

```bash
gcloud run jobs update data-pipeline-pipeline --region=europe-west1 \
  --set-secrets="DB_PASSWORD=data-pipeline-db-password:latest"
# Injects the secret value as an environment variable at runtime
# The container never sees the secret name, only the value
```

## Related

- [pubsub-topics-and-subscriptions](https://alp78.github.io/elysium/06-GCP/Serverless/pubsub-topics-and-subscriptions) — Push subscriptions can trigger Cloud Run Services
- [pubsub-messaging](https://alp78.github.io/elysium/06-GCP/Serverless/pubsub-messaging) — Cloud Run Services as push subscription endpoints
- [gcs-object-operations](https://alp78.github.io/elysium/06-GCP/Storage/gcs-object-operations) — Jobs typically read input from and write output to GCS
- [service-accounts-and-iam](https://alp78.github.io/elysium/06-GCP/Security/service-accounts-and-iam) — `roles/run.invoker` to trigger jobs; SA attached to the job for GCS/BQ access
- [gcp-projects-and-apis](https://alp78.github.io/elysium/06-GCP/Core/gcp-projects-and-apis) — `run.googleapis.com` must be enabled
- [cloud-logging](https://alp78.github.io/elysium/06-GCP/Logging/cloud-logging) — Job logs are available in Cloud Logging by resource type `cloud_run_job`

## References

- [Cloud Run Jobs overview](https://cloud.google.com/run/docs/create-jobs)
- [Executing jobs](https://cloud.google.com/run/docs/execute/jobs)
- [Container image best practices](https://cloud.google.com/run/docs/tips/general)
