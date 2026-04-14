---
title: "03 - Airflow Deployment"
tags:
  - orchestration
  - airflow
  - gcp
  - docker
description: "The real deployment story for the live STOXX Airflow 3.2 platform on the stoxx-airflow VM, including Docker Compose topology, Google provider wiring, DAG delivery, and the actual setup failures and fixes."
created: 2026-03-22
updated: 2026-04-13
status: complete
parent: "[[domain-airflow]]"
links:
  - "[[01-airflow-core-concepts]]"
  - "[[02-airflow-dag-patterns]]"
  - "[[04-airflow-troubleshooting]]"
  - "[[05-airflow-problems]]"
---

# Airflow Deployment

The Airflow deployment that matters in this vault is not a hypothetical Cloud Composer environment and not a laptop-only tutorial stack. It is the self-hosted Airflow 3.2 runtime currently running on the private Compute Engine VM `stoxx-airflow` in project `bq-wh-nb`, and it orchestrates the real STOXX data path from yfinance to GCS, SQL Server, BigQuery, Firestore, and Eventarc.

## What This Note Covers

This note documents the actual deployment model used for the live STOXX orchestration platform and the exact setup issues that had to be solved before the DAG could run end to end.

- Why the platform uses a private VM plus Docker Compose instead of Composer.
- The real Compose topology, executor choice, Google provider wiring, and DAG delivery method.
- The commands used to validate the runtime after bootstrap.
- The setup failures that actually occurred, with their error text, diagnosis, resolution, and guardrails.

## Glossary / Key Terms

> [!info] Key Terms
>
> | Term | Definition | Why it matters here | Caveat |
> |---|---|---|---|
> | Self-hosted Airflow | An Airflow deployment where the team owns the VM, containers, upgrades, and supporting services. | `stoxx-airflow` is self-hosted on Compute Engine. | This gives control, but it also makes bootstrap and incident handling your responsibility. |
> | Compose stack | A multi-container application defined in `docker-compose.yaml`. | Airflow, Postgres, and Redis are deployed as one Compose application. | Compose startup order is not enough by itself; health checks still matter. |
> | CeleryExecutor | An Airflow executor that queues work through a broker and runs it on workers. | The live platform uses Redis plus a Celery worker. | It introduces two critical dependencies: broker availability and worker health. |
> | Application Default Credentials | Google client libraries resolving credentials from the VM service account. | The Google provider uses the VM's service account to call Cloud Run. | ADC does not remove the requirement for the Airflow connection record. |
> | DAG delivery | The method used to move DAG code onto the runtime host. | The live deployment copies DAG files onto the VM and installs them into the mounted DAG directory. | Host ownership and container UID mismatches can break direct copies. |
> | Health check | A probe that marks a container healthy, unhealthy, or starting. | The Airflow containers each have explicit health checks in Compose. | A container can be running while still failing its health check. |
> | Drift | Configuration differences between the intended and actual runtime state. | The blank `SERVING_JOB` variable created deployment drift during restart. | Drift often appears as noisy restarts rather than a clean failure message. |

## The Real Deployment Model

The platform is intentionally simple and inspectable. One private VM hosts the Airflow control plane. Airflow delegates all heavy work to Cloud Run jobs that connect to GCS, SQL Server, BigQuery, and Firestore.

### Why This Platform Uses A VM Instead Of Composer

The current platform is a production-demo environment with strong needs for inspectability and direct control:

- the team needs SSH-level access to the runtime during rollout
- the DAG and images change quickly during demo preparation
- the runtime is intentionally small and private
- the pipeline already externalizes compute into Cloud Run jobs, so Airflow itself does not need to autoscale large in-cluster workloads

That makes a private VM plus Docker Compose a reasonable control-plane choice for this phase.

#### Use Cloud Composer When

Cloud Composer becomes the better fit when Airflow must be treated as shared platform infrastructure instead of as a small, inspectable control plane for one environment.

> [!info] Cloud Composer Costs
>
> Cloud Composer is expensive relative to self-hosted Airflow. A small environment is roughly `$300-500/month`. A medium environment with multiple workers can exceed `$1,500/month`.
>
> Set `--min-workers 1` and `--max-workers N` to enable autoscaling and keep idle spend bounded.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {
  'primaryColor': '#292e42',
  'primaryTextColor': '#c0caf5',
  'primaryBorderColor': '#565f89',
  'lineColor': '#565f89',
  'secondaryColor': '#1a1b26',
  'tertiaryColor': '#24283b',
  'noteTextColor': '#c0caf5',
  'noteBkgColor': '#292e42',
  'textColor': '#c0caf5',
  'fontSize': '14px'
}}}%%
flowchart LR
    WS[Operator workstation]
    IAP[IAP SSH tunnel]
    VM[stoxx-airflow VM<br>10.132.0.9]
    AF[Airflow 3.2 Compose stack]
    CR[Cloud Run jobs]
    SQL[stoxx-vm SQL Server]
    GCS[stoxx-stage-bucket]
    BQ[BigQuery marts]
    FS[Firestore main]

    WS --> IAP --> VM --> AF
    AF --> CR
    CR --> GCS
    CR --> SQL
    CR --> BQ
    CR --> FS
```

### The Live Compose Topology

The deployment is defined in the real [docker-compose.yaml](</C:/Users/aperi/My Drive/VAULT/.codex-temp/airflow-vm/docker-compose.yaml:1>) file, not in an example stack.

#### Read The Real Compose Core

The excerpt below is the actual deployment shape used by the live runtime.

> [!example] Real Compose Configuration
>
> ```yaml
> environment:
>   AIRFLOW__CORE__EXECUTOR: CeleryExecutor
>   AIRFLOW__CORE__AUTH_MANAGER: airflow.providers.fab.auth_manager.fab_auth_manager.FabAuthManager
>   AIRFLOW__DATABASE__SQL_ALCHEMY_CONN: postgresql+psycopg2://airflow:airflow@postgres/airflow
>   AIRFLOW__CELERY__RESULT_BACKEND: db+postgresql+psycopg2://airflow:airflow@postgres/airflow
>   AIRFLOW__CELERY__BROKER_URL: redis://:@redis:6379/0
>   GCP_PROJECT_ID: ${GCP_PROJECT_ID}
>   GCP_REGION: ${GCP_REGION}
>   STAGE_FETCH_JOB: ${STAGE_FETCH_JOB}
>   STAGE_LOAD_JOB: ${STAGE_LOAD_JOB}
>   TRANSFORM_JOB: ${TRANSFORM_JOB}
>   SERVING_JOB: ${SERVING_JOB:-stoxx-serving}
>
> services:
>   airflow-apiserver:
>     command: api-server
>   airflow-scheduler:
>     command: scheduler
>   airflow-dag-processor:
>     command: dag-processor
>   airflow-worker:
>     command: celery worker
>   airflow-triggerer:
>     command: triggerer
>   postgres:
>     image: postgres:16
>   redis:
>     image: redis:7.2-bookworm
> ```

Operationally, that means:

- Airflow state lives in Postgres.
- Celery queueing depends on Redis.
- provider operators inherit environment variables such as the project, region, and Cloud Run job names.
- the `SERVING_JOB` line has a baked-in fallback because the blank-variable failure already happened once and was fixed directly in the file.

## Bootstrap And Validation Steps

The following steps are the live bootstrap and validation path that turned the VM into a working Airflow runtime.

### Bring The Compose Stack Up

This subsection covers the point where the Airflow services become a real control plane instead of a collection of files on disk.

#### Start The Stack And Verify Container Health

Run this on first bootstrap, after upgrading the Airflow image, or after editing Compose configuration. It is typically triggered by the Airflow runtime must be started or restarted. This is a state-changing remote command executed through IAP. It requires SSH access to the VM and Docker permissions via `sudo`. Start the Compose stack and confirm that the core services become healthy.

*The live validation command for the running platform is the same one used during the rollout.*

```powershell
gcloud compute ssh stoxx-airflow `
  --project=bq-wh-nb `
  --zone=europe-west1-b `
  --tunnel-through-iap `
  --command "cd /home/alexper_recovery_gmail_com/app && sudo docker compose ps"
```

```text
NAME                          IMAGE                 COMMAND                  SERVICE                 CREATED       STATUS                 PORTS
app-airflow-apiserver-1       stoxx-airflow:3.2.0   "/usr/bin/dumb-init …"   airflow-apiserver       2 hours ago   Up 2 hours (healthy)   0.0.0.0:8080->8080/tcp, [::]:8080->8080/tcp
app-airflow-dag-processor-1   stoxx-airflow:3.2.0   "/usr/bin/dumb-init …"   airflow-dag-processor   2 hours ago   Up 2 hours (healthy)   8080/tcp
app-airflow-scheduler-1       stoxx-airflow:3.2.0   "/usr/bin/dumb-init …"   airflow-scheduler       2 hours ago   Up 2 hours (healthy)   8080/tcp
app-airflow-triggerer-1       stoxx-airflow:3.2.0   "/usr/bin/dumb-init …"   airflow-triggerer       2 hours ago   Up 2 hours (healthy)   8080/tcp
app-airflow-worker-1          stoxx-airflow:3.2.0   "/usr/bin/dumb-init …"   airflow-worker          2 hours ago   Up 2 hours (healthy)   8080/tcp
app-postgres-1                postgres:16           "docker-entrypoint.s…"   postgres                5 hours ago   Up 5 hours (healthy)   5432/tcp
app-redis-1                   redis:7.2-bookworm    "docker-entrypoint.s…"   redis                   5 hours ago   Up 5 hours (healthy)   6379/tcp
```

This output is the current health baseline for the environment. It is the first thing to compare against after any deployment change.

| Flag | Syntax | Description |
|---|---|---|
| `compose ps` | `docker compose ps` | Prints service state, health, and exposed ports for the stack. |
| `sudo` | `sudo docker compose ...` | Runs Docker commands with the required host privileges. |
| `--tunnel-through-iap` | `gcloud compute ssh ... --tunnel-through-iap` | Reaches the private VM through IAP. |

### Register The Google Provider Surfaces

The Airflow runtime was not usable until the Google provider surfaces were wired correctly. Two separate fixes were required: a connection record and an IAM role.

#### Add `google_cloud_default`

Run this on a fresh Airflow metadata database or any rebuilt environment where the Google connection has not been created yet. It is typically triggered by google provider tasks complain about missing `google_cloud_default`, or the connection list does not contain it. This is a state-changing Airflow CLI command executed inside the worker container. It writes to the Airflow metadata database. Create the default Google connection record that `CloudRunExecuteJobOperator` resolves implicitly.

*This is the exact command that fixed the missing-connection issue during rollout.*

```powershell
gcloud compute ssh stoxx-airflow `
  --project=bq-wh-nb `
  --zone=europe-west1-b `
  --tunnel-through-iap `
  --command "
    cd /home/alexper_recovery_gmail_com/app &&
    sudo docker compose exec -T airflow-worker `
      airflow connections add google_cloud_default `
      --conn-uri 'google-cloud-platform://'
  "
```

```text
Successfully added conn_id=google_cloud_default : google-cloud-platform://
```

*The follow-up verification command proves the record exists in the metadata database.*

```powershell
gcloud compute ssh stoxx-airflow `
  --project=bq-wh-nb `
  --zone=europe-west1-b `
  --tunnel-through-iap `
  --command "cd /home/alexper_recovery_gmail_com/app && sudo docker compose exec -T airflow-worker airflow connections get google_cloud_default"
```

```text
id | conn_id              | conn_type             | description | host | schema | login | password | port | is_encrypted | is_extra_encrypted | extra_dejson | get_uri
===+======================+=======================+=============+======+========+=======+==========+======+==============+====================+==============+=========================
1  | google_cloud_default | google_cloud_platform | None        |      |        | None  | None     | None | False        | False              | {}           | google-cloud-platform://
```

The provider then combined that connection object with the VM's service-account credentials through `google.auth.default()`.

#### Grant Cloud Run Execution Permission

Run this after provisioning the VM service account if the Airflow worker must execute Cloud Run jobs. It is typically triggered by `CloudRunExecuteJobOperator` receives a `403 Permission 'run.jobs.run' denied` error. This is a state-changing IAM command run from the workstation. It modifies the project IAM policy. Allow the Airflow VM service account to execute Cloud Run jobs in project `bq-wh-nb`.

*This is the exact IAM fix applied during rollout.*

```powershell
gcloud projects add-iam-policy-binding bq-wh-nb `
  --member="serviceAccount:bq-wh-sa@bq-wh-nb.iam.gserviceaccount.com" `
  --role="roles/run.developer" `
  --condition=None
```

```text
Updated IAM policy for project [bq-wh-nb].
```

The reason this matters is subtle but important: the VM service account already had broad data-service permissions, yet the Airflow Google operator still could not execute Cloud Run jobs until `run.jobs.run` was granted.

| Flag | Syntax | Description |
|---|---|---|
| `connections add` | `airflow connections add <conn_id> --conn-uri <uri>` | Creates or registers an Airflow connection in the metadata database. |
| `--conn-uri` | `--conn-uri 'google-cloud-platform://'` | Stores the connection as a URI-style connection definition. |
| `--member` | `gcloud projects add-iam-policy-binding ... --member=...` | Specifies which principal receives the IAM role. |
| `--role` | `... --role=roles/run.developer` | Grants the required Cloud Run execution permission surface. |
| `--condition=None` | `... --condition=None` | Adds the binding without an IAM condition. |

### Deliver DAG Code To The VM

The live DAG directory is host-mounted into the Airflow containers. That makes DAG delivery easy when permissions are correct and surprisingly brittle when they are not.

#### Install The DAG File Using A Temp Copy And `install`

Run this when updating a DAG file on the VM and the mounted DAG directory is owned by container UID `50000`. It is typically triggered by A direct `gcloud compute scp` into `/home/alexper_recovery_gmail_com/app/dags` fails with `permission denied`. This is a state-changing deployment step. It copies the file to the operator's home directory first, then installs it into the DAG directory with the correct ownership and mode. Publish the DAG file without breaking host ownership or container-readability.

*The direct copy failed first.*

```text
gcloud compute scp dags/stoxx_stage_yfinance.py -> stoxx-airflow:/home/alexper_recovery_gmail_com/app/dags/stoxx_stage_yfinance.py
pscp: unable to open /home/alexper_recovery_gmail_com/app/dags/stoxx_stage_yfinance.py: permission denied
ERROR: (gcloud.compute.scp) ... exited with return code [1].
```

*The working deployment path copied to the home directory and then installed the file with the correct owner.*

```text
gcloud compute scp dags/stoxx_stage_yfinance.py -> ~/stoxx_stage_yfinance.py

stoxx_stage_yfinance.py   | 1 kB |   1.8 kB/s | ETA: 00:00:00 | 100%
sudo install -o 50000 -g root -m 664 ~/stoxx_stage_yfinance.py /home/alexper_recovery_gmail_com/app/dags/stoxx_stage_yfinance.py
```

This fix is specific to the host-mounted DAG directory pattern. It is not a generic Airflow issue; it is a deployment-ownership issue caused by the way the containers mount host storage.

## Real Deployment Problems Encountered

The rest of this note preserves the actual deployment failures. They are part of the platform now because every future operator needs to know what already broke and why.

### Problem 1: Missing `google_cloud_default`

The VM had valid Google credentials through its service account, but Airflow still failed because the connection record itself did not exist.

#### Problem

Airflow's Google provider surface was incomplete on first bootstrap.

#### Context

The goal was to run `CloudRunExecuteJobOperator` tasks from the fresh Airflow 3.2 deployment on `stoxx-airflow`.

#### Exact Command / Action

The first Airflow task tests attempted to run the STOXX DAG before the default Google connection had been created.

#### Actual Output / Logs

The deployment record in [05-airflow-on-compute-engine](</C:/Users/aperi/My Drive/VAULT/Elysium/06-GCP/02-Compute/05-airflow-on-compute-engine.md:575>) captured the required fix, and the successful creation output was:

```text
Successfully added conn_id=google_cloud_default : google-cloud-platform://
```

#### Diagnosis

Application Default Credentials only solved the credential source. The Airflow provider still expected the named Airflow connection object to exist.

#### Resolution

Create `google_cloud_default` with `airflow connections add ... --conn-uri 'google-cloud-platform://'`.

#### Validation

`airflow connections get google_cloud_default` returned the expected record, and subsequent task tests logged:

```text
Getting connection using `google.auth.default()` since no explicit credentials are provided.
```

#### Prevention Rule

Treat the Airflow connection object and the credential source as two separate setup steps. A VM service account does not remove the need to seed the connection catalog.

### Problem 2: The VM Service Account Could Not Execute Cloud Run Jobs

This was the first real orchestration permission failure.

#### Problem

The Airflow worker could authenticate to Google APIs but still could not execute Cloud Run jobs.

#### Context

The goal was to run the first Cloud Run-backed Airflow tasks for the STOXX pipeline.

#### Exact Command / Action

`CloudRunExecuteJobOperator` attempted to execute `stoxx-stage-fetch` from inside the Airflow task.

#### Actual Output / Logs

The live deployment note recorded the exact failure:

```text
google.api_core.exceptions.PermissionDenied:
403 Permission 'run.jobs.run' denied on resource
'projects/bq-wh-nb/locations/europe-west1/jobs/stoxx-stage-fetch'
```

#### Diagnosis

The service account `bq-wh-sa@bq-wh-nb.iam.gserviceaccount.com` had enough access for storage and data services, but not the specific Cloud Run job execution permission needed by the operator.

#### Resolution

Grant `roles/run.developer` at the project level.

#### Validation

The follow-up Airflow task tests for `fetch_bronze_stage_into_gcs` and `load_bronze_into_sql` both completed successfully.

#### Prevention Rule

When an Airflow task triggers another control-plane service, check the invoked service's execution permissions explicitly instead of assuming broad project access is enough.

### Problem 3: Direct DAG Copy Failed Because The Mounted DAG Directory Was Not Writable

The deployment method itself broke before Airflow had a chance to parse the DAG.

#### Problem

A direct copy into the host-mounted DAG directory failed with `permission denied`.

#### Context

The goal was to publish the updated `stoxx_stage_yfinance.py` file onto the VM after extending the DAG.

#### Exact Command / Action

`gcloud compute scp` tried to write directly into `/home/alexper_recovery_gmail_com/app/dags/`.

#### Actual Output / Logs

```text
pscp: unable to open /home/alexper_recovery_gmail_com/app/dags/stoxx_stage_yfinance.py: permission denied
ERROR: (gcloud.compute.scp) ... exited with return code [1].
```

#### Diagnosis

The host-mounted DAG directory was effectively controlled by container UID `50000`, so the direct copy path from the workstation did not have the required write ownership.

#### Resolution

Copy the DAG to the operator's home directory first, then install it into the DAG folder with `sudo install -o 50000 -g root -m 664 ...`.

#### Validation

After the temp-copy installation, `airflow dags list | grep stoxx_stage_yfinance` showed the DAG from `/opt/airflow/dags/stoxx_stage_yfinance.py`.

#### Prevention Rule

For host-mounted DAG volumes, standardize a deployment path that writes to a temp location first and then uses `install` or `mv` with explicit ownership.

### Problem 4: `SERVING_JOB` Was Blank During Compose Restart

This was a configuration-drift failure that looked like a health incident.

#### Problem

The Compose restart used an unset `SERVING_JOB` environment variable, producing repeated warnings and briefly leaving all Airflow containers in `health: starting`.

#### Context

The goal was to deploy the extended DAG and refresh the Airflow services after adding the serving steps.

#### Exact Command / Action

The stack was restarted before `SERVING_JOB` had a default value in the Compose file.

#### Actual Output / Logs

```text
time="2026-04-13T17:23:43Z" level=warning msg="The \"SERVING_JOB\" variable is not set. Defaulting to a blank string."
...
app-airflow-dag-processor-1   ... Up 7 seconds (health: starting)
app-airflow-triggerer-1       ... Up 8 seconds (health: starting)
app-airflow-worker-1          ... Up 1 second (health: starting)
```

#### Diagnosis

The Airflow environment depended on a variable that was not guaranteed to be present. The stack was not fully broken, but the deployment was noisy and fragile because the DAG could resolve an empty serving job name.

#### Resolution

Bake the default into Compose:

```yaml
SERVING_JOB: ${SERVING_JOB:-stoxx-serving}
```

#### Validation

After the Compose fix, the stack returned to a clean steady state:

```text
app-airflow-dag-processor-1   ... Up 13 minutes (healthy)
app-airflow-triggerer-1       ... Up 13 minutes (healthy)
```

#### Prevention Rule

Every environment variable that maps to a named runtime dependency should either be required and validated before startup or given a safe default directly in the deployment file.

## Deployment Guardrails

The live rollout established a few rules that should now be treated as platform standards.

### Use Non-Interactive Validation After Every Change

After any DAG, image, or Compose change, validate at least these surfaces:

- `docker compose ps`
- `airflow dags list | grep stoxx_stage_yfinance`
- `airflow config get-value core executor`
- `airflow connections get google_cloud_default`

That sequence is fast, reproducible, and catches most drift before an operator triggers a full DAG run.

### Treat Health State Separately From Running State

A service being `Up` is not enough. During the `SERVING_JOB` incident, the containers were running but still reported `health: starting`. For this platform, healthy means:

- the scheduler health endpoint returns `200`
- the dag processor and triggerer job checks succeed
- the worker answers the Celery ping health check

### Keep DAG Delivery Boring

The deployment path is now known:

- copy to a safe temp path
- install into the DAG directory with explicit ownership
- restart only the services that need a refresh
- validate DAG visibility before triggering any run

That is simpler and safer than improvising direct host writes into mounted directories.

## What To Remember

The live Airflow deployment is a self-hosted, private, Compose-based control plane with three critical properties:

- Airflow itself is small and stateful.
- Google integration depends on both Airflow metadata objects and GCP IAM.
- the deployment path is only reliable when ownership, defaults, and health checks are explicit.

The next note turns those facts into an operational runbook by showing how to diagnose the failures that actually occurred on this platform.
