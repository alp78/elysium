---
type: reference
category: orchestration
technology: [gcp, python]
tags: [reference, orchestration, scheduling, gcp, cloud-scheduler, cloud-functions, cloud-run, pub-sub, workflows]
aliases: [Cloud Scheduler, Cloud Tasks, Cloud Workflows, Cloud Functions trigger, GCP scheduling, serverless scheduling, cron GCP, GCP cron, managed cron GCP, cloud scheduler http target, cloud scheduler pubsub]
keywords: [cloud scheduler, cloud tasks, cloud workflows, gcloud scheduler, cron, managed cron, serverless scheduling, cloud run schedule, cloud functions trigger, pub/sub trigger, eventarc, task queue, rate limiting, retry backoff, workflow orchestration, YAML workflow, parallel branches, subworkflows, connectors, gcloud scheduler jobs create, gcloud scheduler jobs run, gcloud scheduler jobs pause, gcloud scheduler jobs resume, gcloud workflows run, gcloud tasks queues create, invoker role, scheduler service account, cost comparison, decision matrix, data pipeline schedule]
description: "Exhaustive reference for all GCP scheduling and workflow services — Cloud Scheduler (managed cron), Cloud Tasks (task queues), Cloud Workflows (serverless orchestration), and patterns for triggering Cloud Run jobs and Cloud Functions on a schedule."
related: [cloud-run-jobs-vs-services, pubsub-topics-and-subscriptions, pubsub-messaging, service-accounts-and-iam, cloud-logging, gcp-projects-and-apis]
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# GCP Scheduling Services — Complete Reference

GCP offers four distinct scheduling and workflow primitives that data engineers routinely confuse: **Cloud Scheduler** (managed cron — fire and forget at a time), **Cloud Tasks** (durable task queues with rate control), **Cloud Workflows** (multi-step serverless orchestration), and **Eventarc** (event-driven function triggers). Knowing when to reach for each one — and how to wire them together — eliminates entire classes of operational complexity. This note covers all four plus the patterns that connect them.

---

## Cloud Scheduler

### What It Is

Cloud Scheduler is Google's fully managed cron-as-a-service. You define a schedule (Unix cron expression), a target (HTTP endpoint, Pub/Sub topic, or App Engine), and a payload. Cloud Scheduler fires the job at the scheduled time, handles retries on failure, and provides execution history — without you running a cron daemon anywhere.

Think of it as replacing the cron tab entry on a VM with a managed, durable, monitored, multi-region service. The scheduler itself is regional but survives single-zone outages.

> [!info] Required API
> Enable before first use: `gcloud services enable cloudscheduler.googleapis.com`
> Cloud Scheduler requires an App Engine application in the project (it uses App Engine's scheduling infrastructure internally). Run `gcloud app create --region=europe-west1` if the project has no App Engine app yet.

---

### Cron Expression Syntax

Cloud Scheduler uses standard Unix cron syntax with full timezone support:

```
┌─────────── minute (0–59)
│ ┌───────── hour (0–23)
│ │ ┌─────── day of month (1–31)
│ │ │ ┌───── month (1–12 or JAN–DEC)
│ │ │ │ ┌─── day of week (0–7, both 0 and 7 = Sunday, or SUN–SAT)
│ │ │ │ │
* * * * *
```

**Common schedule expressions:**

```
0 6 * * *          Every day at 06:00 UTC
0 6 * * 1-5        Weekdays at 06:00 UTC
0 */4 * * *        Every 4 hours
30 8,20 * * *      Twice a day at 08:30 and 20:30
0 0 1 * *          First of every month at midnight
0 9 * * MON        Every Monday at 09:00
*/15 * * * *       Every 15 minutes
0 0 * * 0          Every Sunday at midnight
```

> [!warning] Timezone Matters
> Cloud Scheduler jobs default to UTC unless you specify `--time-zone`. For business-hour schedules (e.g., "run at 9 AM London time"), always set the timezone explicitly — otherwise DST shifts will silently move your schedule by an hour. Use tz database names: `Europe/London`, `America/New_York`, `Asia/Tokyo`.

---

### Creating Jobs — HTTP Target

The HTTP target is the most flexible: Cloud Scheduler sends an HTTP request to any URL at the scheduled time. This is how you trigger Cloud Run jobs, Cloud Run services, and external APIs.

```bash
# Create an HTTP-target scheduler job that triggers a Cloud Run Job
gcloud scheduler jobs create http daily-pipeline \
  --location=europe-west1 \
  --schedule="0 6 * * *" \
  --time-zone="Europe/London" \
  --uri="https://run.googleapis.com/v2/projects/my-project/locations/europe-west1/jobs/my-etl-job:run" \
  --message-body="{}" \
  --oauth-service-account-email=scheduler-sa@my-project.iam.gserviceaccount.com \
  --http-method=POST \
  --attempt-deadline=30m \
  --max-retry-attempts=3 \
  --min-backoff=1m \
  --max-backoff=10m \
  --max-doublings=3
# --schedule: cron expression
# --time-zone: tz database name (default is UTC)
# --uri: the Cloud Run Jobs run API endpoint
# --oauth-service-account-email: SA used to generate OAuth token for auth
# --attempt-deadline: how long to wait for HTTP response before treating as failure
# --max-retry-attempts: retry count on failure (0–5)
# --min-backoff / --max-backoff: exponential backoff bounds
# --max-doublings: max times the backoff interval is doubled before reaching --max-backoff
```

```bash
# Create an HTTP job calling an external REST API (no auth)
gcloud scheduler jobs create http weekly-report \
  --location=europe-west1 \
  --schedule="0 8 * * MON" \
  --time-zone="Europe/London" \
  --uri="https://api.internal.example.com/reports/generate" \
  --message-body='{"report_type":"weekly","format":"csv"}' \
  --http-method=POST \
  --headers="Content-Type=application/json,X-Api-Key=PLACEHOLDER" \
  --attempt-deadline=5m
# --headers: custom HTTP headers as KEY=VALUE pairs (comma-separated)
# For sensitive header values, inject via Secret Manager at deploy time
```

---

### Creating Jobs — Pub/Sub Target

The Pub/Sub target publishes a message to a topic at the scheduled time. The message then triggers whatever subscribes to that topic — a Cloud Function, a pull consumer, or a push subscription to Cloud Run. This is the fan-out pattern: one schedule can trigger multiple downstream consumers via one topic.

```bash
# Create a Pub/Sub-target scheduler job
gcloud scheduler jobs create pubsub daily-ingest-trigger \
  --location=europe-west1 \
  --schedule="0 5 * * *" \
  --time-zone="UTC" \
  --topic=projects/my-project/topics/daily-ingest \
  --message-body='{"source":"scheduler","pipeline":"daily-ingest"}' \
  --attributes="env=prod,version=2"
# --topic: full resource path of the Pub/Sub topic
# --message-body: the message payload (string, often JSON)
# --attributes: Pub/Sub message attributes (key=value pairs, comma-separated)
#   Attributes are indexed metadata — useful for filtering subscriptions
```

> [!tip] Pub/Sub Target vs HTTP Target
> Use the **Pub/Sub target** when you want loose coupling: the scheduler does not need to know who consumes the event. Multiple consumers can subscribe. The trigger is durable — if a consumer is temporarily down, Pub/Sub retains the message.
> Use the **HTTP target** when you need direct invocation with an immediate result and you know the exact endpoint.

---

### Creating Jobs — App Engine Target

Legacy target for App Engine HTTP handlers. Rarely used for new systems — prefer HTTP target pointing at Cloud Run.

```bash
# App Engine target (legacy pattern — prefer HTTP target for new jobs)
gcloud scheduler jobs create app-engine legacy-task \
  --location=europe-west1 \
  --schedule="0 7 * * *" \
  --relative-url="/cron/daily-task" \
  --http-method=GET
```

---

### Managing Existing Jobs

```bash
# List all scheduler jobs in a location
gcloud scheduler jobs list --location=europe-west1

# Describe a job (see full config, last run, next run)
gcloud scheduler jobs describe daily-pipeline --location=europe-west1
# Shows: schedule, timezone, target, retry config, state (ENABLED/PAUSED), userUpdateTime

# Force-trigger a job immediately (outside its schedule)
gcloud scheduler jobs run daily-pipeline --location=europe-west1
# Useful for: testing after creating a new job, ad-hoc reruns, debugging

# Update a job (change schedule, URI, retry config)
gcloud scheduler jobs update http daily-pipeline \
  --location=europe-west1 \
  --schedule="0 7 * * *" \
  --max-retry-attempts=5
# Only specify the fields you want to change — others are preserved

# Pause a job (stops firing; preserves config)
gcloud scheduler jobs pause daily-pipeline --location=europe-west1
# Use case: maintenance windows, disabling data ingestion temporarily

# Resume a paused job
gcloud scheduler jobs resume daily-pipeline --location=europe-west1

# Delete a job
gcloud scheduler jobs delete daily-pipeline --location=europe-west1
```

---

### Retry Configuration

Cloud Scheduler retries failed job executions (HTTP non-2xx response, or timeout) using configurable exponential backoff:

| Parameter | gcloud flag | Default | Description |
|---|---|---|---|
| Max retry attempts | `--max-retry-attempts` | 0 | Times to retry after initial failure (0–5) |
| Max retry duration | `--max-retry-duration` | 0 (unlimited) | Wall-clock time budget for all retries |
| Min backoff | `--min-backoff` | 5s | Initial wait before first retry |
| Max backoff | `--max-backoff` | 1h | Cap on backoff interval |
| Max doublings | `--max-doublings` | 5 | Times the backoff doubles before capping |
| Attempt deadline | `--attempt-deadline` | 3m | Per-attempt timeout (max 30m for HTTP) |

**Backoff calculation:**
```
retry 1: min-backoff * 2^0 = min-backoff
retry 2: min-backoff * 2^1
...
retry N: min(min-backoff * 2^(N-1), max-backoff)  # capped at max-backoff
```

> [!warning] Idempotency Requirement
> Because Cloud Scheduler will retry on failure, your target endpoint MUST be idempotent — running it twice should produce the same result as running it once. Design Cloud Run jobs with this in mind: check whether work was already done before starting, use upserts instead of inserts, or use the execution ID as a deduplication key.

---

### IAM: What Cloud Scheduler Needs

Cloud Scheduler must be authorized to invoke its target. The mechanism differs by target type:

```bash
# For HTTP target invoking Cloud Run:
# The scheduler job's --oauth-service-account-email SA needs roles/run.invoker
gcloud projects add-iam-policy-binding my-project \
  --member="serviceAccount:scheduler-sa@my-project.iam.gserviceaccount.com" \
  --role="roles/run.invoker"

# For HTTP target invoking a specific Cloud Run service (more restrictive):
gcloud run services add-iam-policy-binding my-service \
  --region=europe-west1 \
  --member="serviceAccount:scheduler-sa@my-project.iam.gserviceaccount.com" \
  --role="roles/run.invoker"

# For Pub/Sub target: Cloud Scheduler has a built-in service agent
# (service-<PROJECT_NUMBER>@gcp-sa-cloudscheduler.iam.gserviceaccount.com)
# Grant it the publisher role on the topic:
gcloud pubsub topics add-iam-policy-binding daily-ingest \
  --member="serviceAccount:service-123456789@gcp-sa-cloudscheduler.iam.gserviceaccount.com" \
  --role="roles/pubsub.publisher"
# The project number is found via: gcloud projects describe my-project --format="value(projectNumber)"
```

> [!info] OAuth vs OIDC for HTTP Targets
> - `--oauth-service-account-email`: Cloud Scheduler generates a short-lived OAuth2 access token on behalf of the SA. Works for Google APIs (Cloud Run, etc.).
> - `--oidc-service-account-email` + `--oidc-token-audience`: Generates an OIDC token. Use for Cloud Run services configured to require OIDC audience validation.
> For Cloud Run Jobs triggered via the Cloud Run API, OAuth is correct.

---

### Pricing

Cloud Scheduler pricing (as of 2025):
- **Free tier:** 3 jobs per month per billing account
- **Paid:** ~$0.10 per job per month for each job beyond the free tier
- No charge per execution — only per job existence

For a typical data engineering setup with 10–20 scheduler jobs, the cost is $1–2/month. This is negligible compared to the cost of running the scheduled workloads themselves.

---

## Cloud Tasks

### What Cloud Tasks Is (and Is Not Cloud Scheduler)

Cloud Tasks is a **durable task queue** — you enqueue tasks programmatically, and Cloud Tasks delivers them to worker endpoints with configurable rate limiting, concurrency control, and retry-with-backoff. It is NOT a cron scheduler. The distinction is fundamental:

| Dimension | Cloud Scheduler | Cloud Tasks |
|---|---|---|
| Who creates tasks | Google (on a schedule) | Your application code |
| When tasks fire | At a fixed time | ASAP after enqueue (or at a scheduled time) |
| Task creation rate | 1 per schedule interval | Thousands per second |
| Primary use case | Periodic jobs | Fan-out, rate-limited processing, async work |
| Deduplication | N/A | Yes (task names) |
| Task payload | Fixed per job | Dynamic per task |

**When to use Cloud Tasks instead of Scheduler:**
- You need to create 1,000 tasks from a single trigger (e.g., one task per row in a batch)
- You need to rate-limit outbound calls to a third-party API (e.g., 10 calls/second max)
- You need deduplication by task name (prevents double-processing)
- You need to delay task execution by a programmatic amount

---

### Creating Queues and Tasks

```bash
# Enable the API
gcloud services enable cloudtasks.googleapis.com

# Create a task queue
gcloud tasks queues create my-pipeline-queue \
  --location=europe-west1 \
  --max-dispatches-per-second=5 \
  --max-concurrent-dispatches=10 \
  --max-attempts=5 \
  --min-backoff=10s \
  --max-backoff=5m \
  --max-doublings=4
# --max-dispatches-per-second: rate limit — max tasks delivered per second
# --max-concurrent-dispatches: max tasks in-flight simultaneously
# --max-attempts: total attempts per task (including first attempt; -1 = unlimited)
# Backoff parameters control retry timing (same semantics as Cloud Scheduler)

# Describe a queue (see current config and stats)
gcloud tasks queues describe my-pipeline-queue --location=europe-west1

# List queues
gcloud tasks queues list --location=europe-west1

# Create a task (HTTP target)
gcloud tasks create-http-task \
  --queue=my-pipeline-queue \
  --location=europe-west1 \
  --url=https://my-worker-service.run.app/process \
  --method=POST \
  --body-content='{"item_id":"abc123","operation":"transform"}' \
  --header="Content-Type:application/json" \
  --task-name=process-abc123 \
  --schedule-time="2026-03-22T10:00:00Z"
# --task-name: optional unique name — prevents duplicate task creation
#   If a task with this name already exists (and was recently created/completed),
#   the new create call is rejected → idempotent enqueue
# --schedule-time: delay execution until this time (ISO 8601 UTC)
#   Omit for "execute ASAP"

# Purge a queue (delete all queued tasks — use carefully)
gcloud tasks queues purge my-pipeline-queue --location=europe-west1

# Pause/resume a queue
gcloud tasks queues pause my-pipeline-queue --location=europe-west1
gcloud tasks queues resume my-pipeline-queue --location=europe-west1
```

**Creating tasks from Python** (the more common pattern — application code fans out work):

```python
# Python: create Cloud Tasks tasks programmatically
# pip install google-cloud-tasks

from google.cloud import tasks_v2
import json

def enqueue_tasks(item_ids: list[str], worker_url: str, queue_name: str, project: str, location: str):
    """Fan out: one task per item ID into Cloud Tasks queue."""
    client = tasks_v2.CloudTasksClient()
    parent = client.queue_path(project, location, queue_name)

    for item_id in item_ids:
        payload = json.dumps({"item_id": item_id, "operation": "process"}).encode()
        task = {
            "http_request": {
                "http_method": tasks_v2.HttpMethod.POST,
                "url": worker_url,
                "headers": {"Content-Type": "application/json"},
                "body": payload,
                "oidc_token": {
                    "service_account_email": "tasks-invoker@my-project.iam.gserviceaccount.com"
                },
            },
            "name": client.task_path(project, location, queue_name, f"process-{item_id}"),
        }
        client.create_task(request={"parent": parent, "task": task})
```

---

### Rate Limiting and Concurrency

Cloud Tasks rate limiting is a key differentiator. When calling a third-party API that imposes a rate limit (e.g., 100 requests/minute), set `--max-dispatches-per-second=1.67` (100/60). Cloud Tasks will smooth out the delivery, preventing 429 errors even if your producer enqueues 10,000 tasks at once.

```bash
# Update rate limits on an existing queue
gcloud tasks queues update my-pipeline-queue \
  --location=europe-west1 \
  --max-dispatches-per-second=2 \
  --max-concurrent-dispatches=5
# These settings can be changed live without disrupting in-flight tasks
```

> [!tip] Cloud Tasks for Third-Party API Rate Limiting
> If you need to call an external API (e.g., a financial data vendor) for 5,000 tickers daily, do NOT loop and call synchronously — you will hit rate limits. Instead: enqueue 5,000 tasks with `--max-dispatches-per-second=10`. Cloud Tasks delivers exactly 10 tasks/second to your worker, which calls the API once per task. The queue acts as a governor.

---

### When to Use Tasks vs Scheduler vs Pub/Sub

| Scenario | Use This |
|---|---|
| Run a job at 6 AM every day | Cloud Scheduler |
| Enqueue 1,000 items for processing after a trigger | Cloud Tasks |
| Deduplicate task execution (named tasks) | Cloud Tasks |
| Rate-limit calls to a third-party API | Cloud Tasks |
| Fan-out a single event to multiple consumers | Pub/Sub |
| Durable event log for replay | Pub/Sub |
| Trigger a function on file upload | Eventarc / Pub/Sub |
| Multi-step orchestration with conditions | Cloud Workflows |
| Complex pipeline DAG with dependencies | Cloud Composer (Airflow) |

---

## Cloud Workflows

### What It Is

Cloud Workflows is a fully managed, serverless workflow engine. You define multi-step processes in YAML (or JSON), and Cloud Workflows executes them reliably — with built-in state persistence, conditional branching, parallel execution, error handling, and retry logic. It can call Cloud Run, Cloud Functions, any REST API, and built-in GCP service connectors.

**The key differentiator from Cloud Scheduler:** Cloud Workflows executes a sequence of steps and tracks state between them. Cloud Scheduler fires a single HTTP request and moves on. If your "job" is really three sequential API calls with a branch based on the result of step 2, that is a workflow, not a cron job.

**The key differentiator from Cloud Composer (Airflow):** Cloud Workflows is lightweight and has no infrastructure to manage. Cloud Composer provisions a managed Airflow environment (GKE cluster + database) with significant overhead ($200–500/month minimum). For workflows with fewer than 20 steps and no complex dependency graphs, Cloud Workflows is dramatically cheaper and simpler.

> [!info] Required API
> `gcloud services enable workflows.googleapis.com`

---

### YAML Workflow Syntax

```yaml
# Example: multi-step data pipeline workflow
# File: my-pipeline-workflow.yaml

main:
  steps:
    # Step 1: Extract data from source
    - extract:
        call: http.post
        args:
          url: https://my-extract-service.run.app/extract
          auth:
            type: OIDC
          body:
            date: ${sys.now()}
            source: "sql-server"
        result: extract_result

    # Step 2: Check extract succeeded
    - check_extract:
        switch:
          - condition: ${extract_result.code == 200}
            next: transform
          - condition: ${extract_result.code != 200}
            next: handle_extract_failure

    # Step 3: Transform
    - transform:
        call: http.post
        args:
          url: https://my-transform-service.run.app/transform
          auth:
            type: OIDC
          body:
            input_path: ${extract_result.body.output_path}
        result: transform_result

    # Step 4: Load
    - load:
        call: http.post
        args:
          url: https://my-load-service.run.app/load
          auth:
            type: OIDC
          body:
            data_path: ${transform_result.body.output_path}
            target_table: "production.daily_fact"
        result: load_result

    # Step 5: Return result
    - return_result:
        return: ${load_result.body}

    # Error handler for extract failure
    - handle_extract_failure:
        raise:
          code: 500
          message: ${"Extract failed with HTTP " + string(extract_result.code)}
```

---

### Conditions and Branching

```yaml
main:
  steps:
    - get_record_count:
        call: http.get
        args:
          url: https://my-api.run.app/count
          auth:
            type: OIDC
        result: count_response

    - decide_strategy:
        switch:
          - condition: ${count_response.body.count > 1000000}
            next: full_load_path
          - condition: ${count_response.body.count > 0}
            next: incremental_load_path
          - condition: ${count_response.body.count == 0}
            next: no_data_exit

    - full_load_path:
        call: http.post
        args:
          url: https://my-loader.run.app/load
          body:
            strategy: "full"
        result: load_result
        next: finish

    - incremental_load_path:
        call: http.post
        args:
          url: https://my-loader.run.app/load
          body:
            strategy: "incremental"
        result: load_result
        next: finish

    - no_data_exit:
        return: "No data to process"

    - finish:
        return: ${load_result.body}
```

---

### Parallel Branches

```yaml
main:
  steps:
    - parallel_ingest:
        parallel:
          branches:
            - branch_equities:
                steps:
                  - ingest_equities:
                      call: http.post
                      args:
                        url: https://ingest-service.run.app/ingest
                        body:
                          asset_class: "equities"
                      result: equities_result
            - branch_fx:
                steps:
                  - ingest_fx:
                      call: http.post
                      args:
                        url: https://ingest-service.run.app/ingest
                        body:
                          asset_class: "fx"
                      result: fx_result
            - branch_rates:
                steps:
                  - ingest_rates:
                      call: http.post
                      args:
                        url: https://ingest-service.run.app/ingest
                        body:
                          asset_class: "rates"
                      result: rates_result
    # All three branches complete before this step runs
    - aggregate:
        return:
          equities: ${equities_result.body}
          fx: ${fx_result.body}
          rates: ${rates_result.body}
```

> [!tip] Parallel Branches for Independent Pipeline Legs
> If you are ingesting multiple independent data sources that do not depend on each other, use parallel branches. A workflow with three sequential steps that each take 5 minutes takes 15 minutes. The same three steps in parallel branches takes 5 minutes (plus overhead). This is the primary performance lever in Cloud Workflows.

---

### Error Handling

```yaml
main:
  steps:
    - try_extract:
        try:
          call: http.post
          args:
            url: https://my-service.run.app/extract
            auth:
              type: OIDC
          result: response
        except:
          as: e
          steps:
            - log_error:
                call: sys.log
                args:
                  text: ${"Extraction failed: " + json.encode_to_string(e)}
                  severity: ERROR
            - raise_error:
                raise: ${e}
        retry:
          predicate: ${http.default_retry_predicate}
          max_retries: 3
          backoff:
            initial_delay: 10
            max_delay: 60
            multiplier: 2
```

---

### Subworkflows

Reusable workflow fragments — equivalent to functions:

```yaml
main:
  steps:
    - run_equities:
        call: ingest_asset_class
        args:
          asset_class: "equities"
          target_dataset: "prod_equities"
        result: equities_result
    - run_fx:
        call: ingest_asset_class
        args:
          asset_class: "fx"
          target_dataset: "prod_fx"
        result: fx_result

# Subworkflow — called like a function
ingest_asset_class:
  params: [asset_class, target_dataset]
  steps:
    - call_ingest_api:
        call: http.post
        args:
          url: https://ingest-service.run.app/ingest
          body:
            asset_class: ${asset_class}
            dataset: ${target_dataset}
        result: response
    - return_result:
        return: ${response.body}
```

---

### GCP Service Connectors

Cloud Workflows includes built-in connectors for GCP services — no HTTP calls needed:

```yaml
main:
  steps:
    # Call BigQuery directly via connector (no HTTP boilerplate)
    - run_bq_query:
        call: googleapis.bigquery.v2.jobs.insert
        args:
          projectId: my-project
          body:
            configuration:
              query:
                query: "CALL `my-project.procedures.daily_aggregate`()"
                useLegacySql: false
        result: bq_job

    # Wait for the BigQuery job to complete
    - wait_for_bq:
        call: googleapis.bigquery.v2.jobs.get
        args:
          projectId: my-project
          jobId: ${bq_job.jobReference.jobId}
        result: job_status
```

---

### Deploying and Running Workflows

```bash
# Deploy a workflow from a YAML file
gcloud workflows deploy my-pipeline-workflow \
  --location=europe-west1 \
  --source=my-pipeline-workflow.yaml \
  --service-account=workflow-sa@my-project.iam.gserviceaccount.com
# --service-account: the SA the workflow uses to call HTTP endpoints and GCP APIs

# Execute a workflow (one-off run)
gcloud workflows run my-pipeline-workflow \
  --location=europe-west1 \
  --data='{"date":"2026-03-22","env":"prod"}'
# --data: JSON input arguments available as ${args} in the workflow

# List executions
gcloud workflows executions list my-pipeline-workflow \
  --location=europe-west1 \
  --limit=10

# Describe an execution (see status, error, result)
gcloud workflows executions describe EXECUTION_ID \
  --workflow=my-pipeline-workflow \
  --location=europe-west1

# Cancel a running execution
gcloud workflows executions cancel EXECUTION_ID \
  --workflow=my-pipeline-workflow \
  --location=europe-west1
```

```bash
# Schedule a workflow with Cloud Scheduler (the standard pattern)
gcloud scheduler jobs create http trigger-my-pipeline \
  --location=europe-west1 \
  --schedule="0 6 * * *" \
  --time-zone="Europe/London" \
  --uri="https://workflowexecutions.googleapis.com/v1/projects/my-project/locations/europe-west1/workflows/my-pipeline-workflow/executions" \
  --message-body='{"argument":"{\"env\":\"prod\"}"}' \
  --oauth-service-account-email=scheduler-sa@my-project.iam.gserviceaccount.com
# The scheduler SA needs roles/workflows.invoker to trigger workflow executions
```

---

### When to Use Workflows vs Airflow vs Cloud Composer

| Dimension | Cloud Workflows | Cloud Composer (Airflow) |
|---|---|---|
| Infrastructure | Fully serverless | Managed GKE + Postgres (~$200–500/month) |
| Setup time | Minutes | 20–40 minutes for environment creation |
| DAG complexity | Simple to moderate (YAML steps) | Complex (Python DAGs, sensors, XComs) |
| Cross-system integration | GCP APIs + HTTP endpoints | Any system via operators/hooks |
| Backfill support | Manual (run executions per date) | Native (`catchup=True`) |
| Retry granularity | Per-step | Per-task |
| Monitoring | Cloud Logging + Console UI | Airflow UI (rich DAG visualization) |
| Best for | GCP-internal pipelines, < 20 steps | Complex multi-system pipelines |

> [!info] Decision Rule
> If your workflow consists entirely of calls to GCP services and Cloud Run endpoints, and you do not need backfill or sensor-based waiting (e.g., "wait for a file to appear in GCS"), Cloud Workflows is the right choice — it costs a fraction of Cloud Composer and has zero infrastructure overhead. Once you need backfill semantics, XCom sharing, or operators for non-GCP systems (SFTP, SAP, on-prem), reach for Airflow.

---

## Triggering Cloud Run Jobs on Schedule

### The Serverless Pipeline Pattern

The most common GCP data engineering pattern: Cloud Scheduler fires at a cron time → calls the Cloud Run Jobs API → your containerised pipeline stage runs to completion → exits. No always-on servers. No Kubernetes management. You pay only for the compute time the job actually uses.

```
Cloud Scheduler (cron)
    │ HTTP POST (OAuth token)
    ▼
Cloud Run Jobs API
    │ creates Execution
    ▼
Cloud Run Job (Docker container)
    │ runs pipeline stage
    ├─► reads from SQL Server / GCS / BigQuery
    ├─► processes / transforms data
    └─► writes to BigQuery / GCS
         (job exits, billing stops)
```

---

### Full Setup: Scheduler to Cloud Run Job

```bash
# Step 1: Ensure the Cloud Run Job exists
gcloud run jobs describe my-etl-job --region=europe-west1
# If it doesn't exist, create/deploy it first via gcloud run jobs create or CI/CD

# Step 2: Create a dedicated service account for the scheduler
gcloud iam service-accounts create cloud-scheduler-sa \
  --display-name="Cloud Scheduler SA — triggers Cloud Run Jobs" \
  --description="Used by Cloud Scheduler to invoke Cloud Run Jobs via the API"

# Step 3: Grant the SA permission to trigger Cloud Run Jobs
# Option A: project-level (all Cloud Run jobs in the project)
gcloud projects add-iam-policy-binding my-project \
  --member="serviceAccount:cloud-scheduler-sa@my-project.iam.gserviceaccount.com" \
  --role="roles/run.invoker"

# Option B: job-level (least privilege — only this specific job)
gcloud run jobs add-iam-policy-binding my-etl-job \
  --region=europe-west1 \
  --member="serviceAccount:cloud-scheduler-sa@my-project.iam.gserviceaccount.com" \
  --role="roles/run.invoker"

# Step 4: Create the Cloud Scheduler job
gcloud scheduler jobs create http trigger-my-etl-job \
  --location=europe-west1 \
  --schedule="0 6 * * 1-5" \
  --time-zone="Europe/London" \
  --uri="https://run.googleapis.com/v2/projects/my-project/locations/europe-west1/jobs/my-etl-job:run" \
  --message-body="{}" \
  --http-method=POST \
  --oauth-service-account-email=cloud-scheduler-sa@my-project.iam.gserviceaccount.com \
  --attempt-deadline=10m \
  --max-retry-attempts=2 \
  --min-backoff=2m \
  --max-backoff=10m

# Step 5: Test immediately (force-run outside schedule)
gcloud scheduler jobs run trigger-my-etl-job --location=europe-west1

# Step 6: Verify the Cloud Run Job execution was created
gcloud run jobs executions list --job=my-etl-job --region=europe-west1 --limit=3
```

> [!warning] URI Format Is Exact
> The URI for triggering a Cloud Run Job via the scheduler is:
> `https://run.googleapis.com/v2/projects/{PROJECT}/locations/{REGION}/jobs/{JOB_NAME}:run`
> The `:run` suffix is the action. Omitting it or using the wrong API version (v1 vs v2) will result in 404 errors that are difficult to diagnose from scheduler logs alone.

---

### Passing Runtime Arguments via Scheduler

Cloud Run Jobs accept argument overrides at execution time. You can pass these from the scheduler via the HTTP body:

```bash
# Scheduler job that passes arguments to override the Cloud Run Job's defaults
gcloud scheduler jobs create http trigger-etl-with-args \
  --location=europe-west1 \
  --schedule="0 6 * * *" \
  --uri="https://run.googleapis.com/v2/projects/my-project/locations/europe-west1/jobs/my-etl-job:run" \
  --message-body='{"overrides":{"containerOverrides":[{"args":["--date","$(date +%Y-%m-%d)","--env","prod"]}]}}' \
  --http-method=POST \
  --oauth-service-account-email=cloud-scheduler-sa@my-project.iam.gserviceaccount.com
# The body follows the Cloud Run Jobs API v2 RunJobRequest schema
# containerOverrides.args replaces the container's CMD arguments
```

> [!warning] Static Date in Scheduler Body
> The `$(date +%Y-%m-%d)` in the `--message-body` is NOT evaluated by Cloud Scheduler — it is treated as a literal string. Cloud Scheduler does not support shell expansion or template variables. If you need dynamic dates, pass a sentinel value (e.g., `"--date","auto"`) and have the container compute the date itself.

---

### Monitoring Cloud Run Job Executions Triggered by Scheduler

```bash
# List recent executions of the Cloud Run Job
gcloud run jobs executions list \
  --job=my-etl-job \
  --region=europe-west1 \
  --limit=10 \
  --format="table(name,completionTime,succeeded,failed)"

# Describe a specific execution (check completion status)
gcloud run jobs executions describe EXECUTION_NAME \
  --region=europe-west1

# Stream logs from a specific execution in real-time
gcloud run jobs executions logs EXECUTION_NAME \
  --region=europe-west1

# Query Cloud Logging for all executions of a job (last 24 hours)
gcloud logging read \
  'resource.type="cloud_run_job" AND resource.labels.job_name="my-etl-job"' \
  --freshness=24h \
  --format="table(timestamp,severity,textPayload)"

# Query for failures only
gcloud logging read \
  'resource.type="cloud_run_job" AND resource.labels.job_name="my-etl-job" AND severity>=ERROR' \
  --freshness=7d
```

---

## Triggering Cloud Functions

### Cloud Scheduler to Pub/Sub to Cloud Function

The classic event-driven pattern. Cloud Scheduler publishes a Pub/Sub message; the Cloud Function is triggered by that message. This decouples the scheduler from the function — you can replace the function without touching the scheduler, and Pub/Sub retains the message if the function is temporarily unavailable.

```bash
# Step 1: Create the Pub/Sub topic
gcloud pubsub topics create daily-function-trigger

# Step 2: Deploy a Cloud Function with a Pub/Sub trigger
gcloud functions deploy my-pipeline-function \
  --gen2 \
  --region=europe-west1 \
  --runtime=python312 \
  --source=./functions/my-pipeline \
  --entry-point=handle_trigger \
  --trigger-topic=daily-function-trigger \
  --memory=512MB \
  --timeout=540s \
  --service-account=function-sa@my-project.iam.gserviceaccount.com
# --gen2: use Cloud Functions 2nd gen (backed by Cloud Run — preferred for new deployments)
# --trigger-topic: subscribes the function to this Pub/Sub topic automatically
# --timeout: max execution time (540s = 9 minutes for gen2; up to 60 min with longer timeout setting)

# Step 3: Create the Cloud Scheduler job targeting the Pub/Sub topic
gcloud scheduler jobs create pubsub trigger-function-daily \
  --location=europe-west1 \
  --schedule="0 8 * * 1-5" \
  --time-zone="Europe/London" \
  --topic=daily-function-trigger \
  --message-body='{"pipeline":"daily","env":"prod"}'
```

**Python Cloud Function handler:**

```python
# functions/my-pipeline/main.py
import base64
import json
import functions_framework

@functions_framework.cloud_event
def handle_trigger(cloud_event):
    """Entry point for Pub/Sub-triggered Cloud Function."""
    # Decode the Pub/Sub message
    pubsub_data = base64.b64decode(cloud_event.data["message"]["data"])
    payload = json.loads(pubsub_data)

    pipeline_name = payload.get("pipeline", "default")
    env = payload.get("env", "prod")

    print(f"Running pipeline: {pipeline_name} in env: {env}")
    run_pipeline(pipeline_name, env)
    print("Pipeline complete")

def run_pipeline(name: str, env: str):
    """Your actual pipeline logic."""
    pass
```

---

### HTTP-Triggered Cloud Functions on a Schedule

Simpler alternative: Cloud Scheduler calls the Cloud Function directly via HTTP (no Pub/Sub intermediary). Use when you do not need Pub/Sub's durability or fan-out capabilities.

```bash
# Deploy an HTTP-triggered Cloud Function
gcloud functions deploy my-http-function \
  --gen2 \
  --region=europe-west1 \
  --runtime=python312 \
  --source=./functions/my-http-function \
  --entry-point=handle_http \
  --trigger-http \
  --memory=256MB \
  --timeout=300s \
  --service-account=function-sa@my-project.iam.gserviceaccount.com \
  --no-allow-unauthenticated
# --trigger-http: HTTP trigger (function URL is the endpoint)
# --no-allow-unauthenticated: require OAuth token (Cloud Scheduler provides this)

# Get the function URL
gcloud functions describe my-http-function \
  --gen2 \
  --region=europe-west1 \
  --format="value(serviceConfig.uri)"

# Grant Cloud Scheduler's SA permission to invoke the function
gcloud functions add-invoker-policy-binding my-http-function \
  --region=europe-west1 \
  --member="serviceAccount:cloud-scheduler-sa@my-project.iam.gserviceaccount.com"
# roles/cloudfunctions.invoker (gen1) or roles/run.invoker (gen2) — the CLI handles this

# Create the scheduler job targeting the function URL
gcloud scheduler jobs create http trigger-http-function \
  --location=europe-west1 \
  --schedule="0 */2 * * *" \
  --uri="$(gcloud functions describe my-http-function --gen2 --region=europe-west1 --format='value(serviceConfig.uri)')" \
  --http-method=POST \
  --message-body='{"action":"validate","dataset":"prod"}' \
  --headers="Content-Type=application/json" \
  --oauth-service-account-email=cloud-scheduler-sa@my-project.iam.gserviceaccount.com
```

---

### Eventarc Triggers

Eventarc is the modern event-routing service for Cloud Functions gen2 and Cloud Run. It supports a wider range of event sources beyond Pub/Sub: GCS object finalize, BigQuery events, Audit Log events, and more.

```bash
# Create a Cloud Run service that handles Eventarc events
# Deploy the service first, then create the trigger:

# Trigger on GCS file upload (object finalize event)
gcloud eventarc triggers create gcs-upload-trigger \
  --location=europe-west1 \
  --service-account=eventarc-sa@my-project.iam.gserviceaccount.com \
  --destination-run-service=my-processor-service \
  --destination-run-region=europe-west1 \
  --event-filters="type=google.cloud.storage.object.v1.finalized" \
  --event-filters="bucket=my-ingest-bucket"
# When a file is uploaded to my-ingest-bucket, Eventarc delivers an event
# to my-processor-service (a Cloud Run Service)

# Trigger on BigQuery job completion (Audit Log source)
gcloud eventarc triggers create bq-job-complete-trigger \
  --location=europe-west1 \
  --service-account=eventarc-sa@my-project.iam.gserviceaccount.com \
  --destination-run-service=my-notification-service \
  --destination-run-region=europe-west1 \
  --event-filters="type=google.cloud.audit.log.v1.written" \
  --event-filters="serviceName=bigquery.googleapis.com" \
  --event-filters="methodName=google.cloud.bigquery.v2.JobService.InsertJob"
```

> [!info] Eventarc vs Pub/Sub Trigger
> Eventarc is the preferred mechanism for Cloud Functions gen2 and Cloud Run event triggers. It handles the Pub/Sub subscription plumbing automatically and supports a broader event universe. For new deployments, use Eventarc. The Pub/Sub trigger pattern (`--trigger-topic`) still works but is the gen1 approach.

---

## Comparison Table

### Cloud Scheduler vs Cloud Composer vs Cloud Tasks vs Cloud Workflows vs Cron

| Service | Type | Managed | Cost (approx) | Max complexity | Best for |
|---|---|---|---|---|---|
| Unix cron (on VM) | Time-based trigger | No (you manage VM) | VM cost only | Single command | Legacy, simple scripts on dedicated VMs |
| Cloud Scheduler | Managed cron | Yes | ~$0.10/job/month | Single HTTP/Pub/Sub call | Triggering Cloud Run jobs, periodic API calls |
| Cloud Tasks | Durable task queue | Yes | $0.40/million tasks | Fan-out, rate limiting | Processing large item sets, third-party API rate limits |
| Cloud Workflows | Serverless orchestration | Yes | $0.01/1000 steps | Multi-step with branches | GCP-internal pipelines, < 20 steps, no backfill |
| Cloud Composer (Airflow) | Managed Airflow | Yes | $200–500+/month base | Arbitrary complexity | Complex multi-system pipelines, backfill, sensors |
| Cloud Run Jobs (direct) | Container execution | Yes | Pay per use | One container's logic | Batch processing stages, ETL steps |

### Decision Matrix: Which Scheduling Primitive to Use

```
┌─ Do you need to run something at a fixed time/interval? ──► YES ──►┐
│                                                                      │
▼ NO                                                        ┌─────────▼──────────┐
                                                            │ Cloud Scheduler     │
Use Eventarc (event-driven)                                 │ (managed cron)      │
or Pub/Sub (message-driven)                                 └─────────┬──────────┘
                                                                      │
                                         ┌────────────────────────────▼──────────────────────────────┐
                                         │ What does the trigger need to do?                          │
                                         └────────────────────────────┬──────────────────────────────┘
                                                                       │
                  ┌────────────────────────────────┬──────────────────┼──────────────────────────────┐
                  │                                │                  │                              │
                  ▼                                ▼                  ▼                              ▼
       Fire one Cloud Run Job         Publish event to          Multi-step              Complex DAG, sensors,
       or call one endpoint           Pub/Sub (fan-out)         workflow               backfill, XComs, non-GCP
                  │                                │                  │                              │
       Cloud Scheduler HTTP       Cloud Scheduler Pub/Sub     Cloud Workflows              Cloud Composer
```

---

## Data Engineering Patterns

### Pattern 1: Scheduled Data Pipeline — Scheduler to Cloud Run Job

The foundational pattern. A Cloud Scheduler job fires daily, triggers a Cloud Run Job that connects to a SQL Server source, extracts data, loads it to BigQuery.

```bash
# Full setup in one script
PROJECT=my-project
REGION=europe-west1
JOB_NAME=daily-sql-to-bq
SCHEDULER_SA=cloud-scheduler-sa@${PROJECT}.iam.gserviceaccount.com

# 1. Create scheduler SA
gcloud iam service-accounts create cloud-scheduler-sa \
  --project=${PROJECT} \
  --display-name="Cloud Scheduler — ETL Trigger"

# 2. Grant invoker role on the specific Cloud Run Job (least privilege)
gcloud run jobs add-iam-policy-binding ${JOB_NAME} \
  --region=${REGION} \
  --member="serviceAccount:${SCHEDULER_SA}" \
  --role="roles/run.invoker"

# 3. Create the scheduler job
gcloud scheduler jobs create http schedule-${JOB_NAME} \
  --location=${REGION} \
  --schedule="30 5 * * 1-5" \
  --time-zone="Europe/London" \
  --uri="https://run.googleapis.com/v2/projects/${PROJECT}/locations/${REGION}/jobs/${JOB_NAME}:run" \
  --message-body="{}" \
  --http-method=POST \
  --oauth-service-account-email=${SCHEDULER_SA} \
  --attempt-deadline=30m \
  --max-retry-attempts=2 \
  --min-backoff=5m \
  --max-backoff=20m

echo "Scheduler job created. Test with:"
echo "gcloud scheduler jobs run schedule-${JOB_NAME} --location=${REGION}"
```

---

### Pattern 2: Pub/Sub Fan-Out — One Schedule Triggers Multiple Pipelines

One Cloud Scheduler job publishes to a Pub/Sub topic. Multiple subscriptions fan the message out to independent Cloud Run Jobs or Cloud Functions — each processes a different asset class, region, or dataset in parallel.

```
Cloud Scheduler
    │ publishes to topic: "daily-trigger"
    ▼
Pub/Sub Topic
    ├─► Subscription A → Cloud Run Job: ingest-equities
    ├─► Subscription B → Cloud Run Job: ingest-fx
    └─► Subscription C → Cloud Functions: send-notifications
```

```bash
# Create the shared topic
gcloud pubsub topics create daily-trigger

# Create push subscriptions for each Cloud Run Job
# (Pub/Sub delivers messages to the Cloud Run Jobs API)
gcloud pubsub subscriptions create daily-trigger-equities \
  --topic=daily-trigger \
  --push-endpoint="https://run.googleapis.com/v2/projects/${PROJECT}/locations/${REGION}/jobs/ingest-equities:run" \
  --push-auth-service-account=${SCHEDULER_SA}

gcloud pubsub subscriptions create daily-trigger-fx \
  --topic=daily-trigger \
  --push-endpoint="https://run.googleapis.com/v2/projects/${PROJECT}/locations/${REGION}/jobs/ingest-fx:run" \
  --push-auth-service-account=${SCHEDULER_SA}

# Create the single Cloud Scheduler job
gcloud scheduler jobs create pubsub daily-fan-out \
  --location=${REGION} \
  --schedule="0 6 * * 1-5" \
  --time-zone="Europe/London" \
  --topic=daily-trigger \
  --message-body='{"trigger":"daily","env":"prod"}'
```

> [!tip] Fan-Out vs Sequential Orchestration
> Fan-out via Pub/Sub is for **independent** parallel pipelines — they share a trigger time but do not depend on each other's results. If pipeline B must receive the output of pipeline A, use Cloud Workflows (sequential steps) or Airflow (task dependencies) instead. Pub/Sub does not enforce ordering between subscribers.

---

### Pattern 3: Health Check Scheduling — Periodic API Validation

Schedule a lightweight health check every N minutes that validates API availability, data freshness, or pipeline completion. Alert via Cloud Monitoring when checks fail.

```bash
# Every 15 minutes: call a health check endpoint
gcloud scheduler jobs create http health-check-api \
  --location=${REGION} \
  --schedule="*/15 * * * *" \
  --uri="https://my-api.run.app/health" \
  --http-method=GET \
  --attempt-deadline=30s \
  --max-retry-attempts=0
# --max-retry-attempts=0: no retries — if it fails, alert immediately
# Health checks should fail fast, not retry (a retry could mask a systemic problem)

# Create a Cloud Monitoring alert for scheduler job failures
# (via gcloud monitoring or Terraform — see terraform-iam-and-secrets for the pattern)
# Alert condition: cloudscheduler.googleapis.com/job/attempt_count with failure filter
```

**Python health check function:**

```python
# functions/health-check/main.py
import functions_framework
import requests
import time
from google.cloud import monitoring_v3

@functions_framework.http
def health_check(request):
    """Validates pipeline health: API reachability, data freshness."""
    checks = {}

    # Check 1: API endpoint reachability
    try:
        resp = requests.get("https://upstream-api.example.com/status", timeout=10)
        checks["api_reachable"] = resp.status_code == 200
    except requests.RequestException as e:
        checks["api_reachable"] = False
        checks["api_error"] = str(e)

    # Check 2: BigQuery data freshness (simplified)
    # In production: query BQ for max(ingestion_timestamp) and compare to now
    checks["data_fresh"] = True  # placeholder

    all_healthy = all(v is True for v in checks.values())

    if not all_healthy:
        # Log at ERROR severity so Cloud Monitoring alert fires
        print(f"HEALTH CHECK FAILED: {checks}")
        return {"status": "unhealthy", "checks": checks}, 500

    return {"status": "healthy", "checks": checks}, 200
```

---

### Pattern 4: Cost Optimization — Schedule vs Always-On

A Cloud Run Service with `min-instances=1` costs money 24/7 (to keep one instance warm). If your API is only called during business hours, schedule it to scale down overnight and back up before business hours — saving 50–60% of compute cost.

```bash
# This pattern uses Cloud Scheduler + Cloud Run Service min-instances
# instead of always-on warming

# Scale up at business hours start (8 AM London)
gcloud scheduler jobs create http scale-up-api \
  --location=${REGION} \
  --schedule="0 8 * * 1-5" \
  --time-zone="Europe/London" \
  --uri="https://run.googleapis.com/v2/projects/${PROJECT}/locations/${REGION}/services/my-api:patch" \
  --message-body='{"scaling":{"minInstanceCount":1}}' \
  --http-method=PATCH \
  --oauth-service-account-email=${SCHEDULER_SA}

# Scale down at end of business hours (7 PM London)
gcloud scheduler jobs create http scale-down-api \
  --location=${REGION} \
  --schedule="0 19 * * 1-5" \
  --time-zone="Europe/London" \
  --uri="https://run.googleapis.com/v2/projects/${PROJECT}/locations/${REGION}/services/my-api:patch" \
  --message-body='{"scaling":{"minInstanceCount":0}}' \
  --http-method=PATCH \
  --oauth-service-account-email=${SCHEDULER_SA}
# Scheduler SA needs roles/run.admin to patch the service configuration
```

> [!warning] Scale-Down Risk
> Scaling min-instances to 0 means the next request after scale-down will incur a cold start. If your API serves user-facing requests, test the cold start latency under production load conditions before implementing this pattern. For internal pipeline triggers where a 10-second cold start is acceptable, the cost savings are significant.

---

## Related

- [[cloud-run-jobs-vs-services]] — Cloud Run Jobs are the primary target for Cloud Scheduler in data pipeline architectures
- [[pubsub-topics-and-subscriptions]] — Pub/Sub topics are the fan-out layer between Cloud Scheduler and multiple downstream consumers
- [[pubsub-messaging]] — Publishing and consuming Pub/Sub messages in Python
- [[service-accounts-and-iam]] — `roles/run.invoker`, `roles/workflows.invoker`, `roles/pubsub.publisher` for scheduler service accounts
- [[cloud-logging]] — Diagnosing scheduler job failures and Cloud Run execution errors
- [[gcp-projects-and-apis]] — APIs to enable: `cloudscheduler.googleapis.com`, `workflows.googleapis.com`, `cloudtasks.googleapis.com`, `cloudfunctions.googleapis.com`

## References

- [Cloud Scheduler documentation](https://cloud.google.com/scheduler/docs)
- [Cloud Scheduler cron format](https://cloud.google.com/scheduler/docs/configuring/cron-job-schedules)
- [Cloud Tasks documentation](https://cloud.google.com/tasks/docs)
- [Cloud Workflows syntax reference](https://cloud.google.com/workflows/docs/reference/syntax)
- [Cloud Workflows connectors](https://cloud.google.com/workflows/docs/reference/googleapis)
- [Eventarc triggers reference](https://cloud.google.com/eventarc/docs/triggers)
- [Cloud Run Jobs API — RunJob method](https://cloud.google.com/run/docs/reference/rest/v2/projects.locations.jobs/run)
- [Cloud Functions gen2 triggers](https://cloud.google.com/functions/docs/calling)
