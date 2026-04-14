---
title: "03 - Docker Compose"
tags:
  - docker
aliases:
  - Docker Compose
  - docker compose
  - docker-compose
  - compose
  - multi-container
  - compose file
  - docker-compose.yaml
  - docker-compose.yml
description: "Compose guide grounded in the actual ESG local stack and the live Airflow VM. Covers real compose files, env interpolation, bind mounts, systemd boot flow, and the current and historical troubleshooting trail."
created: 2026-03-22
updated: 2026-04-13
status: complete
---

# Docker Compose

> [!abstract]- Summary
>
> Explains the real Docker Compose control plane for the ESG workstation and the live `stoxx-airflow` VM so operators can resolve actual stack shape, inspect boot orchestration, and diagnose compose-specific drift and healthcheck issues.
>
> **Local and remote topology**
> - Resolve the Windows `docker-compose.yml` model and concrete `stoxx` object names, services, named volumes, bind mounts, published ports, and SQL Server persistence layout
> - Contrast the local developer stack with the VM `app` project so container, network, and volume names are not assumed to match across environments
>
> **Live Airflow VM compose stack**
> - Inspect the live `docker-compose.yaml`, redacted `.env`, shared `x-airflow-common` block, `CeleryExecutor` wiring, bind-mounted paths, and job-binding variables
> - Read the `stoxx-airflow.service` systemd unit and current-boot journal to see how Compose comes up on reboot, including `airflow-init`, `--remove-orphans`, and dependency sequencing
>
> **Real problems and setup trail**
> - Reconcile repo-era `docker run` and `stoxx-index-intelligence` documentation with the live Compose labels and project `bq-wh-nb`
> - Diagnose live false-unhealthy Airflow probes and preserve historical fixes for CRLF-corrupted startup scripts and bind-mount ownership mismatches in the older deployment model
>
> **Operations and safety**
> - Warnings: startup order is not readiness without health gating, host path semantics differ sharply between Windows and Linux, and CLI-based Airflow probes can time out even when the job is alive
> - Troubleshooting: 4 cases covering project drift, false-unhealthy probes, CRLF startup-script failure, and host UID or GID ownership mismatch

> [!note]- Glossary
>
> **Compose file**
> - A YAML document that defines services, networks, volumes, environment, and startup behavior for a multi-container application.
> - The note compares two compose files because local and VM behavior only make sense once the correct file is identified.
>
> > [!warning] One file is not universal
> >
> > The local workstation and the Airflow VM do not share the same compose file. Assuming one YAML file describes both environments leads directly to wrong object names and wrong remediation steps.
>
> ---
>
> **Service**
> - A logical workload definition inside a compose file that tells Docker how a container should be created and run.
> - The note repeatedly separates services declared on disk from containers that already exist on the host.
>
> > [!warning] Declaration is not runtime
> >
> > A service can be present in YAML without a matching container on the host. Runtime inspection is still required before you assume the service exists.
>
> ---
>
> **Compose project name**
> - The namespace prefix Docker Compose applies to stack-owned containers, networks, and volumes.
> - It explains why local objects are named `stoxx-*` while VM objects are named `app-*`, which matters in every inspect command shown in the note.
>
> > [!info] Prefix controls identity
> >
> > Changing the compose project name silently changes almost every runtime identifier. A command copied from another environment often fails for this reason alone.
>
> ---
>
> **`depends_on`**
> - A Compose setting that expresses startup ordering and, when configured, dependency conditions between services.
> - The note uses it as part of the explanation for why boot sequence and health-gated startup must be read carefully on the VM.
>
> > [!warning] Order is not readiness
> >
> > Starting one container before another does not prove the dependency is ready to serve traffic. Health conditions or explicit readiness checks are still required.
>
> ---
>
> **`airflow-init`**
> - A one-shot initialization container in the Airflow stack that prepares metadata state and initial configuration before long-running services depend on it.
> - The note treats its clean exit as a normal part of the VM boot sequence rather than as a failure.
>
> > [!info] Exit is expected
> >
> > `airflow-init` is supposed to stop after completing its work. A stopped init container is healthy behavior if the exit code is successful and downstream services start correctly.
>
> ---
>
> **Bind mount**
> - A direct host-path mount into a container.
> - Bind mounts are central to the note because they explain live code, config, log, and script behavior on both Windows and Linux hosts.
>
> > [!warning] Host behavior leaks through
> >
> > File permissions, path syntax, and line endings come from the host filesystem, not the image. Many compose bugs are really host-path bugs.
>
> ---
>
> **Named volume**
> - Docker-managed persistent storage attached to a container by logical volume name rather than explicit host path.
> - The note uses named volumes to distinguish durable database storage from bind-mounted configuration and bootstrap content.
>
> > [!info] Persistence lives here
> >
> > Recreating a container does not discard data stored in a named volume. Troubleshooting data loss requires knowing whether the path is a bind mount or a volume.
>
> ---
>
> **`docker compose config`**
> - A Docker Compose command that resolves the effective compose model after interpolation and merge.
> - The note uses it to expose actual services and named volumes without relying on a quick visual skim of raw YAML.
>
> > [!info] Resolved view matters
> >
> > `docker compose config` shows what Docker will act on after variable interpolation. That makes it safer than reasoning from partially templated YAML by eye.
>
> ---
>
> **`docker inspect`**
> - A Docker command that returns the full structured metadata for a container, image, volume, or other Docker object.
> - The note relies on inspect output for mounts, labels, and health state because those details are not fully visible in simple list commands.
>
> > [!warning] Narrow the output
> >
> > Full inspect documents are noisy. Using `--format` against a specific field reduces the risk of missing the one property that actually explains the problem.
>
> ---
>
> **Extension field / `x-airflow-common`**
> - A YAML extension pattern used in compose files to define reusable fragments that are merged into multiple services.
> - The VM stack uses `x-airflow-common` to keep shared Airflow settings consistent across several service definitions.
>
> > [!info] Shared config reduces drift
> >
> > When common environment, volume, and image settings live in one shared fragment, updating the stack becomes safer because the same change propagates everywhere that fragment is merged.
>
> ---
>
> **`AIRFLOW_UID`**
> - An environment variable that controls the numeric user ID the Airflow containers run as on the host.
> - It matters in the note because host directory ownership must match this UID for bind-mounted logs, DAGs, and config to remain writable.
>
> > [!warning] UID mismatch breaks mounts
> >
> > If host paths are owned by the wrong numeric user, the container may start but fail to read or write critical files. The resulting errors often look like application bugs instead of filesystem bugs.
>
> ---
>
> **`--remove-orphans`**
> - A `docker compose up` flag that deletes containers no longer declared in the current compose model.
> - The systemd unit uses it so VM boot converges on the current desired stack instead of preserving stale containers from older revisions.
>
> > [!warning] Old containers disappear
> >
> > This flag is useful for drift control, but it also removes forgotten legacy services. Do not use it casually if you are relying on undeclared containers still being present.
>
> ---
>
> **Systemd unit**
> - A service definition managed by systemd that controls how a process or one-shot task starts, stops, and integrates with boot.
> - The Airflow VM uses a systemd unit as the outer control plane that launches Docker Compose on reboot.
>
> > [!info] Boot behavior lives here
> >
> > If the stack comes up unexpectedly, fails on reboot, or runs under the wrong user, inspect the unit first. Compose is only one layer of the control plane on the VM.
>
> ---
>
> **`journalctl`**
> - The standard Linux command for reading logs emitted by systemd-managed units and the broader system journal.
> - The note uses `journalctl` to reconstruct the VM boot path of the compose wrapper service without relying only on container logs.
>
> > [!info] Boot logs show sequencing
> >
> > Container logs explain what a service did after it started. `journalctl` explains whether the service started at all, when it started, and what systemd believed happened around it.
>
> ---
>
> **Compose labels**
> - Metadata labels Docker Compose writes onto managed containers to record project, service, config path, and related identity information.
> - They are the definitive evidence used in the note to prove which compose file and project name the live VM is actually using.
>
> > [!warning] Labels beat assumptions
> >
> > Repo docs and naming conventions can drift. Container labels come from the live runtime and are the more trustworthy source when documentation disagrees with the host.
>
> ---
>
> **Healthcheck timeout**
> - The maximum duration Docker allows a health probe to run before treating the probe attempt as failed.
> - The false-unhealthy Airflow investigation in the note depends on recognizing that a timeout can fail even when the underlying process is still alive.
>
> > [!warning] Slow is not dead
> >
> > A probe that consistently completes just under the timeout threshold is fragile and can flap between healthy and unhealthy with small runtime variations. Probe budget and probe correctness are separate questions.

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
  A[Windows host<br/>C:\\Users\\aperi\\DEV\\ESG] --> B[docker-compose.yml]
  B --> C[stoxx-db]
  B --> D[stoxx-pipeline]
  B --> E[stoxx-dashboard]
  F[stoxx-airflow VM<br/>bq-wh-nb] --> G[systemd<br/>stoxx-airflow.service]
  G --> H[/home/alexper_recovery_gmail_com/app/docker-compose.yaml]
  H --> I[airflow-apiserver]
  H --> J[airflow-scheduler]
  H --> K[airflow-worker]
  H --> L[airflow-dag-processor]
  H --> M[airflow-triggerer]
  H --> N[postgres + redis]
  J --> O[Cloud Run jobs<br/>stage-fetch, bronze-load,<br/>transforms, serving]
  K --> O
```


## Local And Remote Topology

The same Docker Compose command family is driving two very different environments. The local stack is a developer-facing integration environment. The VM stack is a production-like orchestration environment that must survive reboots and start automatically.

### Stack Topology Resolution

This section uses real resolved config and live object state rather than generic YAML fragments. That matters because Compose is doing interpolation, path resolution, project naming, and mount construction that are not obvious from a quick skim of the files.

| Aspect | Local Windows stack | Live Airflow VM stack | Operational consequence |
|---|---|---|---|
| Compose file | `C:\Users\aperi\DEV\ESG\docker-compose.yml` | `/home/alexper_recovery_gmail_com/app/docker-compose.yaml` | Never assume one file describes both environments. |
| Compose project name | `stoxx` | `app` | Container, volume, and network names differ completely. |
| Startup owner | Interactive operator on Windows | `stoxx-airflow.service` under systemd | VM boot recovery is automated; local startup is manual. |
| Stateful service | SQL Server 2022 | PostgreSQL 16 and Redis 7.2 | Database engine, volume paths, and health semantics differ. |
| Port exposure | Host `1434` and `8080` locally | Host `8080` on the VM API server only | Internal VM services are not published to the host. |
| Host-mounted paths | Windows repo paths | `/home/alexper_recovery_gmail_com/app/{dags,logs,config,plugins}` | Filesystem behavior and line-ending risk differ. |

#### PowerShell | docker compose config | resolve the local compose services and named volumes

**When to run:** Before `docker compose up`, before cleanup, or when you need to know which objects the local stack is supposed to create.
**Trigger:** The compose file has changed or the local object names are unclear.
**Context:** PowerShell on the Windows host in `C:\Users\aperi\DEV\ESG`. These are read-only config resolution commands.
**Purpose:** Confirm the service keys and named volumes that the local compose file actually defines.

*Resolves the local service keys from the compose file.*

```powershell
docker compose -f C:\Users\aperi\DEV\ESG\docker-compose.yml config --services
```

```text
db
dashboard
pipeline
```

*Resolves the named volumes declared by the same compose file.*

```powershell
docker compose -f C:\Users\aperi\DEV\ESG\docker-compose.yml config --volumes
```

```text
sqlserver_data
pipeline_logs
```

These outputs prove that the local stack is not an Airflow stack. It is a three-service development stack with one database service and two application services, plus two named volumes. The live local container inventory in [[01-container-lifecycle]] only showed `stoxx-db` running, but the compose model itself still defines all three services and both named volumes.

#### PowerShell | docker inspect | inspect the local SQL Server mount model

**When to run:** When persistence, bootstrap scripts, or schema seed files are not behaving as expected on the local stack.
**Trigger:** SQL Server starts but does not see bootstrap content, or data persistence is unclear.
**Context:** PowerShell on the Windows host. This is a read-only inspect command against the existing `stoxx-db` container.
**Purpose:** Show exactly which host files and which named volume the local SQL Server container is using.

*Inspects the concrete mount set of the running local SQL Server container.*

```powershell
docker inspect stoxx-db --format '{{json .Mounts}}'
```

```text
[{"Type":"volume","Name":"stoxx_sqlserver_data","Source":"/var/lib/docker/volumes/stoxx_sqlserver_data/_data","Destination":"/var/opt/mssql","Driver":"local","Mode":"rw","RW":true,"Propagation":""},{"Type":"bind","Source":"C:\\Users\\aperi\\DEV\\ESG\\db\\ddl\\bronze_schema.sql","Destination":"/docker-entrypoint-initdb.d/bronze_schema.sql","Mode":"rw","RW":true,"Propagation":"rprivate"},{"Type":"bind","Source":"C:\\Users\\aperi\\DEV\\ESG\\db\\seed\\countries.sql","Destination":"/docker-entrypoint-initdb.d/countries.sql","Mode":"rw","RW":true,"Propagation":"rprivate"},{"Type":"bind","Source":"C:\\Users\\aperi\\DEV\\ESG\\docker\\db-init.sh","Destination":"/docker-entrypoint-initdb.d/db-init.sh","Mode":"rw","RW":true,"Propagation":"rprivate"},{"Type":"bind","Source":"C:\\Users\\aperi\\DEV\\ESG\\db\\ddl\\gold_schema.sql","Destination":"/docker-entrypoint-initdb.d/gold_schema.sql","Mode":"rw","RW":true,"Propagation":"rprivate"},{"Type":"bind","Source":"C:\\Users\\aperi\\DEV\\ESG\\db\\ddl\\silver_schema.sql","Destination":"/docker-entrypoint-initdb.d/silver_schema.sql","Mode":"rw","RW":true,"Propagation":"rprivate"},{"Type":"bind","Source":"C:\\Users\\aperi\\DEV\\ESG\\docker\\db-entrypoint.sh","Destination":"/entrypoint.sh","Mode":"rw","RW":true,"Propagation":"rprivate"}]
```

This is the real local persistence model. SQL Server data itself lives in the named volume `stoxx_sqlserver_data`, while the bootstrap scripts and seed DDL are bind-mounted directly from the repo. That means data survives container recreation, but bootstrap script edits are instantly visible because they come straight from the host filesystem.

| Flag | Syntax | Description |
|---|---|---|
| `config --services` | `docker compose config --services` | Lists only the service keys after interpolation and merge. |
| `config --volumes` | `docker compose config --volumes` | Lists the named volumes declared by the compose file. |
| `-f` | `docker compose -f <file> ...` | Forces the intended compose file. |
| `--format` | `docker inspect --format '{{json .Mounts}}'` | Extracts only the mount information instead of the full inspect document. |

## Live Airflow VM Compose Stack

The Airflow VM is a different Compose estate entirely. It has its own compose file, its own `.env`, its own bind-mount root, and a systemd wrapper that starts Compose on boot. This is the operational truth of the current VM on April 13, 2026.

### Live Compose Host Inspection

This section matters because the repo still contains older Airflow documentation for a `docker run` + startup-script deployment. The live VM no longer matches that model. The only safe way to operate the host is to inspect the running compose project and its boot unit directly.

#### Linux | compose.yaml / .env | read the live compose file and its redacted environment keys

**When to run:** Before modifying the VM stack, before restarting the Airflow services, or when a DAG or job binding seems to come from the wrong environment.
**Trigger:** The Airflow VM behavior no longer matches the repo docs or expected service names.
**Context:** Linux shell on `stoxx-airflow`. This is a read-only inspection of the live compose file and `.env`.
**Purpose:** Show the actual service graph, healthchecks, bind mounts, and environment keys used by the live VM.

The live compose file anchors a shared `x-airflow-common` block, uses `CeleryExecutor`, and drives seven long-running services plus one one-shot init service. The VM `.env` below is shown with secrets redacted but with live operational values preserved.

_Shows the shared `x-airflow-common` definition, CeleryExecutor wiring, bind-mounted project paths, and the live `.env` values that bind the VM stack to the `bq-wh-nb` Cloud Run jobs._

```yaml
x-airflow-common:
  &airflow-common
  image: ${AIRFLOW_IMAGE_NAME:-stoxx-airflow:3.2.0}
  build: .
  env_file:
    - .env
  environment:
    &airflow-common-env
    AIRFLOW__CORE__EXECUTOR: CeleryExecutor
    AIRFLOW__DATABASE__SQL_ALCHEMY_CONN: postgresql+psycopg2://airflow:airflow@postgres/airflow
    AIRFLOW__CELERY__RESULT_BACKEND: db+postgresql+psycopg2://airflow:airflow@postgres/airflow
    AIRFLOW__CELERY__BROKER_URL: redis://:@redis:6379/0
    AIRFLOW__CORE__EXECUTION_API_SERVER_URL: "http://airflow-apiserver:8080/execution/"
  volumes:
    - ${AIRFLOW_PROJ_DIR:-.}/dags:/opt/airflow/dags
    - ${AIRFLOW_PROJ_DIR:-.}/logs:/opt/airflow/logs
    - ${AIRFLOW_PROJ_DIR:-.}/config:/opt/airflow/config
    - ${AIRFLOW_PROJ_DIR:-.}/plugins:/opt/airflow/plugins
  user: "${AIRFLOW_UID:-50000}:0"
```

```text
AIRFLOW_UID=50000
AIRFLOW_IMAGE_NAME=stoxx-airflow:3.2.0
AIRFLOW_PROJ_DIR=/home/alexper_recovery_gmail_com/app
_AIRFLOW_WWW_USER_USERNAME=admin
_AIRFLOW_WWW_USER_PASSWORD=<redacted>
FERNET_KEY=<redacted>
AIRFLOW__API_AUTH__JWT_SECRET=<redacted>
AIRFLOW__API_AUTH__JWT_ISSUER=airflow
GCP_PROJECT_ID=bq-wh-nb
STAGE_BUCKET=stoxx-stage-bucket
GCP_REGION=europe-west1
STAGE_FETCH_JOB=stoxx-stage-fetch
STAGE_LOAD_JOB=stoxx-bronze-load
TRANSFORM_JOB=stoxx-transforms
SERVING_JOB=stoxx-serving
```

This is a compose-based Airflow 3.2.0 stack with explicit job bindings to the current `bq-wh-nb` Cloud Run jobs. It also shows the real bind-mount root on the VM: `/home/alexper_recovery_gmail_com/app`, not `/home/airflow`.

#### Linux | systemd | read the unit that starts Compose on boot

**When to run:** After reboot problems, after Compose file changes, or when you need to know how the VM converges back to the desired stack.
**Trigger:** The VM came back but the stack composition looks wrong or stale containers remain after service edits.
**Context:** Linux shell on `stoxx-airflow`. This is a read-only host configuration inspection.
**Purpose:** Show the real boot-time mechanism that starts the Airflow compose project.

*Shows the live systemd unit that starts the Airflow compose stack on the VM.*

```ini
[Unit]
Description=STOXX Airflow Docker Compose Stack
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
User=alexper_recovery_gmail_com
Group=docker
WorkingDirectory=/home/alexper_recovery_gmail_com/app
Environment=HOME=/home/alexper_recovery_gmail_com
ExecStart=/usr/bin/docker compose up -d --remove-orphans
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

This unit is the reason the live VM must be treated as a systemd-managed Compose host, not as a metadata-startup-script host. It uses `docker compose up -d --remove-orphans` from the real working directory and keeps the stack converged to the current compose model on boot.

#### Linux | journalctl | read the actual boot trail from systemd

**When to run:** After reboot, after enabling a new service, or when `airflow-init` and health-gated dependencies do not start in the expected order.
**Trigger:** The VM finished booting but the Airflow stack looks incomplete or misordered.
**Context:** Linux shell on `stoxx-airflow`. This is a read-only journal query against the compose wrapper service.
**Purpose:** Prove the real boot sequence of the current VM stack.

*Reads the current-boot journal for the systemd unit that starts Compose on the VM.*

```bash
gcloud compute ssh stoxx-airflow --project bq-wh-nb --zone europe-west1-b --tunnel-through-iap --command "sudo journalctl -u stoxx-airflow.service -b --no-pager"
```

```text
Apr 13 14:30:23 stoxx-airflow systemd[1]: Starting STOXX Airflow Docker Compose Stack...
Apr 13 14:30:23 stoxx-airflow docker[26536]:  Container app-postgres-1 Running
Apr 13 14:30:23 stoxx-airflow docker[26536]:  Container app-redis-1 Running
Apr 13 14:30:24 stoxx-airflow docker[26536]:  Container app-airflow-init-1 Starting
Apr 13 14:31:09 stoxx-airflow docker[26536]:  Container app-airflow-init-1 Exited
Apr 13 14:31:09 stoxx-airflow docker[26536]:  Container app-airflow-apiserver-1 Healthy
Apr 13 14:31:09 stoxx-airflow systemd[1]: Finished STOXX Airflow Docker Compose Stack.
```

This is the clean boot path of the current VM. PostgreSQL and Redis are treated as prerequisites, `airflow-init` is expected to run and exit, and the systemd unit only finishes after the long-running stack has been brought up under Compose.

| Flag | Syntax | Description |
|---|---|---|
| `--remove-orphans` | `docker compose up -d --remove-orphans` | Removes containers from older compose models that are no longer declared. |
| `-u` | `journalctl -u stoxx-airflow.service` | Filters the journal to the specific systemd unit. |
| `-b` | `journalctl -b` | Limits the log view to the current boot only. |
| `--no-pager` | `journalctl --no-pager` | Prevents interactive paging, which is required for scripted capture. |
| `--project` | `gcloud compute ssh ... --project bq-wh-nb` | Forces the command to the live GCP project. |
| `--zone` | `gcloud compute ssh ... --zone europe-west1-b` | Targets the correct zone. |
| `--tunnel-through-iap` | `gcloud compute ssh ... --tunnel-through-iap` | Uses IAP for VM access. |
| `--command` | `gcloud compute ssh ... --command "<cmd>"` | Runs a non-interactive remote command. |

## Real Problems And Setup Trail

Compose is where environment drift and startup problems become visible first. This section records the problems that were actually encountered while updating this chapter. Some apply to the live Airflow 3.2.0 compose stack. Others belong to the older startup-script-based Airflow generation preserved in the repo and are included because they explain why the repo docs no longer match the running VM.

### Environment Drift Reconciliation

The first compose problem encountered during this chapter rewrite was not a YAML syntax error. It was documentation drift. The repo and the live VM no longer described the same Airflow deployment.

#### Linux | docker inspect | reconcile the repo-era Airflow description with the live VM

**When to run:** Before changing the Airflow VM, before following older repo docs, or before documenting the runtime.
**Trigger:** The repo says `docker run` and `stoxx-index-intelligence`, but the live host looks different.
**Context:** Live VM inspection via `gcloud compute ssh` and Docker container labels. Read-only.
**Purpose:** Identify the actual compose project path, compose file, and project name that the live VM is using.
**Problem:** The repo still documents an older Airflow deployment pattern, while the live VM on April 13, 2026 is a Compose stack in a different GCP project.
**Context:** The first live queries against `stoxx-index-intelligence` failed, and the repo's earlier `docker run`-based Airflow guide did not match the actual running containers.

*Reads the live Compose labels from the running Airflow API server container.*

```bash
gcloud compute ssh stoxx-airflow --project bq-wh-nb --zone europe-west1-b --tunnel-through-iap --command "docker inspect app-airflow-apiserver-1 --format '{{json .Config.Labels}}'"
```

```text
{"com.docker.compose.project":"app","com.docker.compose.project.config_files":"/home/alexper_recovery_gmail_com/app/docker-compose.yaml","com.docker.compose.project.working_dir":"/home/alexper_recovery_gmail_com/app","com.docker.compose.service":"airflow-apiserver","com.docker.compose.version":"5.1.2","org.apache.airflow.version":"3.2.0"}
```

**Diagnosis:** The live host is not using the repo's older `infra/scripts/airflow-startup.sh` model. It is running a Compose project named `app` from `/home/alexper_recovery_gmail_com/app/docker-compose.yaml` in project `bq-wh-nb`.
**Resolution:** This chapter was rewritten against the live `bq-wh-nb` stack and the actual Compose labels instead of repeating the stale repo path.
**Validation:** The label output above aligns with the live `docker compose ps`, `.env`, systemd unit, and Cloud Run job bindings captured elsewhere in this chapter.
**Prevention rule:** Always verify the live project ID, compose working directory, and compose labels before treating existing docs as authoritative.

### Healthcheck Timeout Investigation

The second compose problem is current and live. Two Airflow containers are running, producing logs, and still being marked unhealthy by Compose.

#### Linux | docker inspect / docker exec | capture the false-unhealthy state and time the real probe

**When to run:** When `docker compose ps` reports `unhealthy` but the container logs still show forward progress.
**Trigger:** `airflow-dag-processor` or `airflow-triggerer` appear degraded even though the stack is otherwise functioning.
**Context:** Linux shell on `stoxx-airflow`. Read-only inspection plus a manual execution of the same healthcheck command.
**Purpose:** Distinguish a dead process from a slow probe.
**Problem:** On April 13, 2026, `app-airflow-dag-processor-1` and `app-airflow-triggerer-1` were running but marked unhealthy.
**Context:** The live compose file gives both services a `timeout: 10s` CLI-based healthcheck.

*Reads Docker's recorded health state for the live `airflow-dag-processor` container.*

```bash
gcloud compute ssh stoxx-airflow --project bq-wh-nb --zone europe-west1-b --tunnel-through-iap --command "docker inspect app-airflow-dag-processor-1 --format '{{json .State.Health}}'"
```

```text
{"Status":"unhealthy","FailingStreak":7,"Log":[{"Start":"2026-04-13T17:33:59.268912979Z","End":"2026-04-13T17:34:09.386842741Z","ExitCode":-1,"Output":"Health check exceeded timeout (10s): ... Found one alive job.\n"}]}
```

*Runs the same Airflow job check manually and measures how long it really takes.*

```bash
gcloud compute ssh stoxx-airflow --project bq-wh-nb --zone europe-west1-b --tunnel-through-iap --command "/usr/bin/time -f %E docker exec app-airflow-dag-processor-1 airflow jobs check --job-type DagProcessorJob --hostname 33e75f7b8725 && /usr/bin/time -f %E docker exec app-airflow-triggerer-1 airflow jobs check --job-type TriggererJob --hostname 04af152e5d81"
```

```text
Found one alive job.
0:07.99
Found one alive job.
0:07.95
```

**Diagnosis:** The process heartbeat exists, but the CLI-based probe is running close enough to the `10s` budget that Docker occasionally records it as a timeout. This is a probe-budget problem, not evidence that the Airflow job itself is dead.
**Resolution:** The next safe infrastructure change is to increase these healthcheck timeouts above `10s` or replace the CLI probe with a lighter check. That change was not applied during this documentation pass because it would mutate the live orchestration host.
**Validation:** Manual execution returned `Found one alive job.` for both services in `0:07.99` and `0:07.95`, proving that the job heartbeats exist even when Compose reports `unhealthy`.
**Prevention rule:** If a CLI-based Airflow healthcheck routinely consumes more than about 80% of its timeout budget on the live VM, raise the timeout before the next rollout.

> [!info] Live Verified Workflow
>
> The unhealthy state and the manual probe timings above are live captures from the current VM.

> [!example] Important Conceptual Note Not Executed Here
>
> The remediation change itself was not executed here because it would require editing the live compose file and restarting active Airflow services on the VM.

### Historical Setup Remediation

The repo still contains an older Airflow-on-COS deployment model. That model is no longer the live VM, but the setup failures recorded there remain important because they explain why the repo added line-ending normalization and permission-fix guidance.

#### Linux | sed / terraform | fix CRLF line endings in the earlier startup-script deployment

**When to run:** Only when working with the older metadata-startup-script deployment preserved in the repo.
**Trigger:** The VM boot log shows the shell cannot execute the startup script even though the script is present.
**Context:** Historical setup trail from the repo's earlier Airflow deployment model. The commands below are the actual fix path recorded during that deployment.
**Purpose:** Keep the earlier setup history because it explains a real class of Windows-to-Linux drift.
**Problem:** The startup script failed with `env: 'bash\r': No such file or directory`.
**Context:** The repo originally pushed `infra/scripts/airflow-startup.sh` into VM metadata for a `docker run`-based Airflow stack.

_Normalizes Windows CRLF line endings in `infra/scripts/airflow-startup.sh` with `sed`, then reapplies only the Airflow VM Terraform target so the startup metadata is rewritten with Linux-safe line endings._

```bash
sed -i 's/\r$//' infra/scripts/airflow-startup.sh
terraform -chdir=infra apply -target=google_compute_instance.airflow
```

```text
env: 'bash\r': No such file or directory
```

**Diagnosis:** The script had Windows CRLF line endings, so the Linux shebang and shell parser could not execute it correctly on the VM.
**Resolution:** Normalize line endings before applying Terraform, and use the `replace(file(...), "\r\n", "\n")` pattern in Terraform so the metadata copy is always LF-normalized.
**Validation:** The repo's later `infra/compute.tf` changed the startup-script metadata assignment to `replace(file("${path.module}/scripts/airflow-startup.sh"), "\r\n", "\n")`, which is the durable infrastructure fix.
**Prevention rule:** Any shell script that crosses from Windows editing to Linux execution should be normalized to LF before it becomes a Docker entrypoint or VM startup script.

#### Linux | chown / ls | fix host-path ownership in the earlier Airflow bind mounts

**When to run:** When an Airflow container can see mounted DAG or log paths but cannot write to them.
**Trigger:** Airflow containers start, but logs fail to write or DAG files do not load because ownership is wrong.
**Context:** Historical setup trail from the earlier Airflow deployment model in the repo.
**Purpose:** Preserve the real mount-permission fix because the same UID pattern still exists in the current Compose-based VM stack.
**Problem:** Host-mounted Airflow paths failed with permission errors because they were owned by the wrong UID or GID.
**Context:** The older Airflow stack mounted `/home/airflow/dags` and `/home/airflow/logs` into containers that ran as UID `50000`, while PostgreSQL required UID `999` on its data path.

_Reassigns the Airflow DAG and log directories to UID `50000`, reassigns PostgreSQL data to UID and GID `999`, and verifies the corrected ownership numerically with `ls -ln`._

```bash
sudo chown -R 50000:0 /home/airflow/dags /home/airflow/logs
sudo chown -R 999:999 /home/airflow/pgdata
ls -ln /home/airflow/
```

```text
drwxr-xr-x  50000 0     dags
drwxr-xr-x  50000 0     logs
drwx------  999   999   pgdata
```

**Diagnosis:** The container runtime user IDs and the host directory ownership did not match. Airflow could not write to `dags` and `logs`, and PostgreSQL could not own `pgdata` safely.
**Resolution:** Align the host directory ownership to the runtime UIDs before or immediately after the stack starts.
**Validation:** The expected ownership pattern above is the operational proof that the host paths match the container UIDs.
**Prevention rule:** Every bind-mounted state path should be checked against the service's runtime UID before blaming the application itself.

## Related

- [[01-container-lifecycle]]
- [[02-image-management]]
