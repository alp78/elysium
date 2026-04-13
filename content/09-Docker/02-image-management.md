---
title: "02 - Image Management"
tags:
  - docker
aliases:
  - Docker images
  - docker build
  - docker push
  - docker pull
  - docker tag
  - multi-stage build
  - Artifact Registry
  - Dockerfile instructions
  - docker history
  - build cache
  - image layers
  - .dockerignore
description: "Image management for the real ESG estate: the local Python pipeline image, the local .NET dashboard image, the live Airflow VM image extension, and the current Artifact Registry and Cloud Run job bindings."
created: 2026-03-22
updated: 2026-04-13
status: complete
---

# Image Management

> [!abstract]- Summary
>
> Documents the real Docker image estate for ESG across local build definitions, live build output, the `bq-wh-nb` registry, and current Cloud Run job bindings so build and deployment decisions can be validated against the images actually in use.
>
> **Real Dockerfiles**
> - Inspect the local `docker/pipeline.Dockerfile`, local `docker/dashboard.Dockerfile`, and VM `Dockerfile` to compare single-stage Python, multi-stage .NET, and Airflow base-image extension patterns
> - Track operational details that materially change image behavior, including Microsoft ODBC Driver 18 installation, non-root runtime users, Airflow constraint URLs, and the local `.dockerignore` boundary
>
> **Live build output**
> - Rebuild `stoxx-pipeline:notes-20260413` and `stoxx-dashboard:notes-20260413` with `docker build --progress plain` and interpret BuildKit context size, package installation, publish steps, and exported tags
> - Use captured output to confirm that local builds still restore, publish, and export cleanly before promoting changes into deployment workflows
>
> **Registry and deployment state**
> - Compare local `docker images` inventory with live Artifact Registry tags in `europe-west1-docker.pkg.dev/bq-wh-nb/stoxx-demo` and current `gcloud run jobs list` bindings
> - Identify drift between repo-era `stoxx-index-intelligence` references and live `bq-wh-nb` image paths, tags, digests, and execution states
>
> **Layer and hygiene guidance**
> - Use `docker history --no-trunc --human` to measure the live `stoxx-airflow:3.2.0` extension layer and separate project-specific layers from inherited base-image content
> - Verify `.dockerignore` exclusions that keep build contexts small and keep `.env`, markdown, logs, and runtime data out of builder input
>
> **Operations and safety**
> - Warnings: later-layer cleanup does not shrink earlier layers, tags are mutable while digests are authoritative, and repo registry paths can be stale even when local images still exist
> - Troubleshooting: 1 drift path covering local cache versus live `bq-wh-nb` registry and Cloud Run bindings

> [!note]- Glossary
>
> **Dockerfile**
> - A declarative build recipe that tells Docker how to assemble an image from a base image and a sequence of filesystem and metadata instructions.
> - The note starts by reading Dockerfiles because every later build, registry, and layer observation depends on what the build recipe actually says.
>
> > [!warning] Instruction order matters
> >
> > Docker caches and layers instructions in order. A broad early change invalidates every later build step even if those later commands did not change.
>
> ---
>
> **Build context**
> - The directory tree Docker sends to the builder before any `COPY` or `ADD` instruction executes.
> - Context size directly affects local build time and explains why `.dockerignore` is treated as an operational control in this note.
>
> > [!warning] Context size compounds
> >
> > Large, dirty contexts slow every build whether or not the extra files are copied into the image. Secrets inside the context are also exposed to the builder.
>
> ---
>
> **Layer**
> - A filesystem delta created by an image build instruction such as `RUN`, `COPY`, or `ADD`.
> - Layer boundaries explain cache reuse, image size, and why `docker history` can attribute size to specific build steps.
>
> > [!warning] Cleanup is not shrink
> >
> > Removing files in a later layer does not erase the bytes from an earlier layer. To reduce size, avoid creating the bytes in the first place or restructure the build.
>
> ---
>
> **BuildKit**
> - Docker's modern build backend that adds richer caching, metadata, and structured progress output to image builds.
> - The live build output in the note comes from BuildKit, so understanding its step numbering and transfer lines is necessary to read the captured output correctly.
>
> > [!info] Plain progress helps
> >
> > `--progress plain` turns BuildKit output into line-oriented logs that are easier to capture, diff, and interpret than the interactive TTY progress renderer.
>
> ---
>
> **Single-stage build**
> - A Dockerfile pattern that builds and runs from the same image stage.
> - The pipeline image uses this pattern because its runtime genuinely needs the ODBC driver and Python dependencies installed during the build.
>
> > [!warning] Runtime includes tooling
> >
> > In a single-stage build, every package installed for setup remains in the final runtime image unless it is removed before the layer is committed.
>
> ---
>
> **Multi-stage build**
> - A Dockerfile pattern that uses multiple `FROM` stages so build tooling can be left behind when the final runtime image is assembled.
> - The dashboard image uses this pattern to keep the heavy .NET SDK out of the final ASP.NET runtime image.
>
> > [!info] Builder stays behind
> >
> > Only artifacts explicitly copied from the build stage reach the final image. The build-stage filesystem and tooling are excluded by default.
>
> ---
>
> **Base image**
> - The image referenced by a `FROM` instruction that supplies the starting filesystem and default runtime environment for a new image.
> - Base-image choice determines package manager behavior, shell environment, language runtime version, and security patch inheritance across the note's examples.
>
> > [!warning] Base choice cascades
> >
> > Switching a base image can break package names, libc compatibility, default users, and startup behavior all at once. Treat base-image changes as architectural changes, not cosmetic ones.
>
> ---
>
> **Tag**
> - A mutable human-readable label attached to an image reference, such as `latest` or `20260413-6`.
> - The note uses tags to compare local build results, registry history, and the exact image references bound to Cloud Run jobs.
>
> > [!warning] Tags can move
> >
> > Re-pushing a tag changes what that tag points to without changing its name. A tag alone is not a stable content identity.
>
> ---
>
> **Digest**
> - A content-addressed hash of an image manifest that identifies the exact image content immutably.
> - Digests are the note's source of truth when verifying whether registry state and runtime state really match.
>
> > [!info] Digests are authoritative
> >
> > Two different tags can point to the same digest, and one tag can later point somewhere else. The digest is what proves the bytes are identical.
>
> ---
>
> **Artifact Registry**
> - Google's managed container registry service for storing and serving versioned images to Google Cloud runtimes.
> - The note uses Artifact Registry to establish the live image path in `bq-wh-nb` and to expose drift from older repo references.
>
> > [!warning] Project path drift
> >
> > Registry hostname and repository path encode the owning project. A stale project ID sends operators to the wrong image catalog even if the image name itself looks familiar.

> ---
>
> **Cloud Run job**
> - A Google Cloud runtime that executes a container image on demand as a job rather than serving it continuously as an HTTP service.
> - The note closes the loop by mapping registry tags to the Cloud Run jobs that actually consume them.
>
> > [!warning] Runtime may lag registry
> >
> > A newer tag existing in the registry does not mean the platform is already using it. Always inspect the bound image reference on the runtime itself.
>
> ---
>
> **Constraint file**
> - A version-constraint document used by package installers to lock transitive dependency versions within an expected compatibility range.
> - The Airflow VM image relies on the matching Airflow constraints URL so provider packages stay aligned with the live Airflow release.
>
> > [!warning] Match Airflow versions
> >
> > Using the wrong Airflow constraint set can install packages that resolve successfully but break at runtime because the provider set no longer matches the Airflow core version.
>
> ---
>
> **`.dockerignore`**
> - A file that excludes paths from the Docker build context before the builder receives them.
> - It explains the small transfer sizes in the captured BuildKit output and keeps local-only data and secrets out of image builds.
>
> > [!danger] Context leaks secrets
> >
> > If `.env`, credential files, or runtime data are not ignored, they can be sent to the builder and accidentally copied into layers or exposed in build logs.
>
> ---
>
> **`docker history`**
> - A Docker inspection command that shows the layered build history of an image along with command text and approximate size contribution.
> - The note uses it to separate the custom `stoxx-airflow:3.2.0` extension layer from the inherited official Airflow base image.
>
> > [!info] Top layers tell the story
> >
> > The most recent lines are usually the most relevant project-specific customizations. That makes `docker history` a fast way to see what your team added on top of an upstream base.

> [!example] Image Operations Fit
>
> > [!success] Appropriate
> >
> > - Use this note before rebuilds, rollouts, registry audits, cache cleanup, or Airflow image changes when you need to compare Dockerfiles, local images, registry state, and runtime bindings.
> > - Use it when the question is whether the image currently deployed is really the image you think it is, including tag drift, digest identity, and stale project-path references.
> > - Use it to reason about layer size, build context, and `.dockerignore` hygiene before making build-performance or rollout changes.
>
> > [!failure] Inappropriate
> >
> > - Do not infer deployment truth from local cached images alone; registry digests and runtime bindings are the authority.
> > - Do not rebuild or mutate the live Airflow host during passive inspection or documentation work unless an actual rollout is intended.
> > - Do not assume later-layer cleanup reduces historical image size; layer structure has to be fixed at build design time.

## Real Dockerfiles

The project does not use one generic image strategy. It uses three different build patterns because the operational needs are different: a Python + ODBC data pipeline, a multi-stage .NET dashboard, and a live Airflow extension image that layers extra providers onto the official Airflow base image.

### Image Definition Inspection

These excerpts are the real build inputs in the repo and on the Airflow VM. Read them before running `docker build`, because they explain why the images differ in size, package surface, and runtime user model.

#### Local | Dockerfile | read the Python pipeline image definition

**When to run:** Before rebuilding the pipeline image or diagnosing local/runtime package behavior.
**Trigger:** The pipeline needs a new dependency, ODBC connectivity is failing, or Cloud Run behavior differs from local expectations.
**Context:** This is a file inspection of `C:\Users\aperi\DEV\ESG\docker\pipeline.Dockerfile`. It is read-only.
**Purpose:** Show how the project builds the Python pipeline image, installs SQL Server ODBC dependencies, and sets the runtime entrypoint.

The pipeline image is intentionally single-stage because the runtime itself needs the ODBC driver and Python dependencies. It installs Microsoft ODBC Driver 18, copies the pipeline code, sets a non-root user, and starts with `ddtrace-run python utils/run_pipeline.py`.

_Builds a Python 3.12 pipeline image that installs Microsoft ODBC Driver 18, copies the pipeline codebase, switches to `appuser`, and starts the workload through `ddtrace-run python utils/run_pipeline.py`._

```dockerfile
FROM python:3.12-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       curl gnupg2 unixodbc-dev \
    && curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/microsoft-prod.gpg] https://packages.microsoft.com/debian/12/prod bookworm main" \
       > /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql18 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY utils/ utils/
COPY ingestion/ ingestion/
COPY db/ db/
COPY data/definitions/ data/definitions/
COPY docker/pipeline-entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

RUN groupadd -r appuser && useradd -r -g appuser -d /app -s /sbin/nologin appuser \
    && chown -R appuser:appuser /app
USER appuser

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["ddtrace-run", "python", "utils/run_pipeline.py"]
```

#### Local | Dockerfile | read the dashboard image definition

**When to run:** Before rebuilding the dashboard image, before changing its base runtime, or when publish size matters.
**Trigger:** A dashboard dependency changed, a build is slow, or you need to understand why the runtime image is smaller than the SDK image.
**Context:** This is a file inspection of `C:\Users\aperi\DEV\ESG\docker\dashboard.Dockerfile`. It is read-only.
**Purpose:** Show how the project compiles the Blazor app in one stage and runs it from a smaller ASP.NET runtime stage.

The dashboard image uses a proper multi-stage build. The heavy SDK layer never ships in the final runtime image, and the runtime stage adds a container healthcheck on `/healthz`.

_Uses a multi-stage .NET 10 build that restores and publishes the Blazor app in the SDK stage, then copies only the published output into a smaller ASP.NET runtime image with a `/healthz` healthcheck._

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY dashboard/ESG.Dashboard/ESG.Dashboard.csproj .
RUN dotnet restore

COPY dashboard/ESG.Dashboard/ .
RUN dotnet publish -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app/publish .

RUN groupadd -r appuser && useradd -r -g appuser -d /app appuser \
    && chown -R appuser:appuser /app
USER appuser

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD curl -f http://localhost:8080/healthz || exit 1

ENTRYPOINT ["dotnet", "ESG.Dashboard.dll"]
```

#### Linux | Dockerfile | read the live Airflow VM image extension

**When to run:** Before modifying the Airflow runtime on the VM or when a DAG needs an extra Python package or Airflow provider.
**Trigger:** Airflow imports fail, provider packages are missing, or you need to understand what was added on top of the official Airflow image.
**Context:** This is a live file inspection from `/home/alexper_recovery_gmail_com/app` on `stoxx-airflow`. It is read-only.
**Purpose:** Show how the running VM extends `apache/airflow:3.2.0` with provider packages while staying pinned to the matching Airflow constraints file.

The VM does not run the stock `apache/airflow:3.2.0` image unchanged. It builds `stoxx-airflow:3.2.0` locally on the host and layers in Google provider support using the official Airflow constraints URL pattern.

_Extends the official `apache/airflow:3.2.0` image by copying `requirements.txt`, computing the matching Airflow constraints URL at build time, and installing the Google provider packages needed by the live DAGs._

```dockerfile
FROM apache/airflow:3.2.0

COPY requirements.txt /tmp/requirements.txt

RUN AIRFLOW_VERSION=$(python -c "from airflow import __version__; print(__version__)") \
    && PYTHON_VERSION=$(python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')") \
    && CONSTRAINT_URL="https://raw.githubusercontent.com/apache/airflow/constraints-${AIRFLOW_VERSION}/constraints-${PYTHON_VERSION}.txt" \
    && pip install --no-cache-dir "apache-airflow==${AIRFLOW_VERSION}" -r /tmp/requirements.txt --constraint "${CONSTRAINT_URL}"
```

```text
apache-airflow-providers-google
google-cloud-storage==3.10.1
```

The Airflow extension is intentionally small in code but important in effect. It keeps the base image official and production-oriented, while adding the extra provider and storage client needed by the DAGs on the VM.

| Image | Base image | Build pattern | Runtime user | Operational purpose |
|---|---|---|---|---|
| `stoxx-pipeline` | `python:3.12-slim` | Single-stage | `appuser` in image, overridden to `root` locally by compose | Python data pipeline with SQL Server ODBC access and Datadog tracing entrypoint |
| `stoxx-dashboard` | `mcr.microsoft.com/dotnet/sdk:10.0` -> `mcr.microsoft.com/dotnet/aspnet:10.0` | Multi-stage | `appuser` | Smaller runtime image for the Blazor dashboard |
| `stoxx-airflow:3.2.0` | `apache/airflow:3.2.0` | Base-image extension | Airflow image default `50000` | Add Google provider packages to the live Airflow stack |

## Live Build Output

The next question is whether the Dockerfiles actually build cleanly in the current environment. The commands below were run live on April 13, 2026 from `C:\Users\aperi\DEV\ESG` using Docker Desktop's BuildKit backend.

### Local Image Rebuilds

The local builds are not abstract examples. They are the exact commands used to rebuild current note-specific image tags, and the output below shows the real context transfer size, base image resolution, package installation, and final image export.

#### PowerShell | docker build | rebuild the local pipeline image

**When to run:** After changing `ingestion/`, `utils/`, `db/`, `data/definitions/`, `requirements.txt`, or `docker/pipeline-entrypoint.sh`.
**Trigger:** A pipeline dependency or runtime behavior changed and you need a fresh local image.
**Context:** PowerShell on the Windows host in `C:\Users\aperi\DEV\ESG`. This is a state-changing build that creates a new local image tag.
**Purpose:** Produce a fresh pipeline image and confirm that the ODBC and Python dependency layers still build successfully.

*Rebuilds the local Python pipeline image with plain BuildKit progress output.*

```powershell
docker build --progress plain -f docker/pipeline.Dockerfile -t stoxx-pipeline:notes-20260413 .
```

```text
#0 building with "desktop-linux" instance using docker driver
#4 [internal] load .dockerignore
#4 transferring context: 377B 0.0s done
#5 [internal] load build context
#5 transferring context: 524.43kB 0.1s done
#7 [ 2/13] RUN apt-get update ... ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql18 ...
#7 10.39 Setting up msodbcsql18 (18.6.2.1-1) ...
#10 [ 5/13] RUN pip install --no-cache-dir -r requirements.txt
#10 14.62 Successfully installed beautifulsoup4-4.14.3 ... pyodbc-5.3.0 ... yfinance-1.2.0 ...
#19 exporting manifest sha256:32649470ea25a98a68068616c12253dfe830c3926d1212ea7766432adeb8b154 done
#19 naming to docker.io/library/stoxx-pipeline:notes-20260413 done
```

The build used BuildKit on the `desktop-linux` builder, sent a small `524.43kB` context thanks to the repo `.dockerignore`, installed ODBC Driver 18 successfully, and rebuilt the Python dependency layer from `requirements.txt`. The final image was exported locally under the tag `stoxx-pipeline:notes-20260413`.

#### PowerShell | docker build | rebuild the local dashboard image

**When to run:** After changing the dashboard project, the dashboard Dockerfile, or runtime health endpoint behavior.
**Trigger:** The Blazor application changed and you need a fresh local runtime image.
**Context:** PowerShell on the Windows host in `C:\Users\aperi\DEV\ESG`. This is a state-changing build that creates a new local image tag.
**Purpose:** Prove that the multi-stage dashboard build still restores, publishes, and exports cleanly.

*Rebuilds the local dashboard image with plain BuildKit progress output.*

```powershell
docker build --progress plain -f docker/dashboard.Dockerfile -t stoxx-dashboard:notes-20260413 .
```

```text
#0 building with "desktop-linux" instance using docker driver
#4 [internal] load .dockerignore
#4 transferring context: 377B done
#5 [internal] load build context
#5 transferring context: 200.25kB 0.0s done
#11 [build 4/6] RUN dotnet restore
#11 1.714   Restored /src/ESG.Dashboard.csproj (in 2.98 sec).
#13 [build 6/6] RUN dotnet publish -c Release -o /app/publish
#13 7.641   ESG.Dashboard -> /src/bin/Release/net10.0/ESG.Dashboard.dll
#13 9.508   ESG.Dashboard -> /app/publish/
#16 exporting manifest sha256:3d09a11b85243b07ddbd185ae9299e136df28dca75398a103ff4248fe5b33539 done
#16 naming to docker.io/library/stoxx-dashboard:notes-20260413 done
```

This build shows the advantage of the multi-stage design directly. The heavy SDK image is used only in the build stage, the published output is copied into the runtime stage, and the final exported image is a new `stoxx-dashboard:notes-20260413` tag without the SDK tooling inside it.

| Flag | Syntax | Description |
|---|---|---|
| `--progress` | `docker build --progress plain ...` | Forces BuildKit to emit readable step-by-step plain-text output instead of condensed TTY progress. |
| `-f` | `docker build -f docker/pipeline.Dockerfile ...` | Selects the exact Dockerfile instead of defaulting to `./Dockerfile`. |
| `-t` | `docker build -t stoxx-pipeline:notes-20260413 ...` | Tags the built image with a concrete local name. |
| `.` | `docker build ... .` | Sets the repo root as the build context. |

> [!info] Live VM Build Boundary
>
> The Airflow VM build path was verified from the live `Dockerfile`, `requirements.txt`, container labels, and `docker history`. The image was not rebuilt on the VM during this documentation pass because rerunning builds on the active orchestration host would mutate a live environment.

## Registry And Deployment State

Images only matter operationally when they can be matched to the registry and to the runtime that consumes them. This project currently has a meaningful drift between repo-era registry paths and the live deployment project, so the chapter must record the live state explicitly instead of repeating stale paths.

### Image Inventory And Deployment Bindings

This section combines three views: local image inventory, live Artifact Registry tags, and the Cloud Run jobs currently bound to those images. Read the three together. A local image can exist while the registry path has moved, and a registry tag can exist while the runtime has already advanced to a different tag.

| Field | Source column | Unit / type | Meaning |
|---|---|---|---|
| `REPOSITORY` / `IMAGE` | Image repository path | string | The local or remote image name. |
| `TAG` / `TAGS` | Mutable image label | string | The human-readable name attached to the image or digest. |
| `DIGEST` | Registry manifest hash | string | The immutable content identity of a remote image. |
| `IMAGE ID` | Local image identifier | string | The local image object stored on the Docker host. |
| `CREATE_TIME` / `UPDATE_TIME` | Registry timestamps | timestamp | When the remote image entry was created or updated. |

#### PowerShell | docker images | list the local image inventory

**When to run:** Before a rebuild, before cleanup, or when confirming which historical images are still cached on the workstation.
**Trigger:** You need to know what the local Docker host can run immediately without pulling.
**Context:** PowerShell on the Windows host. This is a read-only inventory command.
**Purpose:** Show which project images and historical registry-tagged images are still present locally.

*Lists the current local image inventory that matters to this project.*

```powershell
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.Size}}"
```

```text
REPOSITORY                                                             TAG           IMAGE ID       SIZE
stoxx-dashboard                                                        latest        fe3194c60e5a   450MB
stoxx-pipeline                                                         latest        f111dc7e04b9   536MB
europe-west1-docker.pkg.dev/stoxx-index-intelligence/stoxx/dashboard   latest        46789c35aea4   444MB
europe-west1-docker.pkg.dev/stoxx-index-intelligence/stoxx/pipeline    latest        10be09be8d6c   484MB
```

The local Docker host still carries images tagged for the older `stoxx-index-intelligence` registry path even though the live deployment project is now `bq-wh-nb`. That is exactly why image notes must always separate local cache state from current deployment truth.

#### PowerShell / Linux | gcloud artifacts docker images list | list the live Artifact Registry tags

**When to run:** Before a rollout, during incident response, or when a job is using a newer tag than expected.
**Trigger:** You need to know which images actually exist in the live registry today.
**Context:** PowerShell or Linux shell with `gcloud` authenticated to the live project. This is a read-only registry query.
**Purpose:** Show the real image tags and digests in the current Artifact Registry repository.

*Lists the live registry tags in the current project.*

```bash
gcloud artifacts docker images list europe-west1-docker.pkg.dev/bq-wh-nb/stoxx-demo --project bq-wh-nb --include-tags --format="table(IMAGE,DIGEST,TAGS,CREATE_TIME,UPDATE_TIME)"
```

```text
IMAGE                                                              DIGEST                                                                   TAGS        CREATE_TIME          UPDATE_TIME
europe-west1-docker.pkg.dev/bq-wh-nb/stoxx-demo/stoxx-bronze-load  sha256:24e74f8af8fb6a90045a927a1cf84ff65882ee564dab8b4cca07e95c9991eede  20260413-1  2026-04-13T17:15:53  2026-04-13T17:15:53
europe-west1-docker.pkg.dev/bq-wh-nb/stoxx-demo/stoxx-serving      sha256:ae50c19b7696ab3275310a0f58e74674719938cfcdc49aa9852f4bbb51efbc63  20260413-6  2026-04-13T19:18:45  2026-04-13T19:18:45
europe-west1-docker.pkg.dev/bq-wh-nb/stoxx-demo/stoxx-stage-fetch  sha256:f14039eafdf2e053d0656882822f962f778f5e8cb03bde6258df5899b2336e81  20260413-2  2026-04-13T17:54:56  2026-04-13T17:54:56
europe-west1-docker.pkg.dev/bq-wh-nb/stoxx-demo/stoxx-transforms   sha256:5a46e2a1c6da0e4bf718fb92edd9296769c912f3a959020235bbf82d4d7dabd7  20260413-1  2026-04-13T18:00:27  2026-04-13T18:00:27
```

This is the authoritative current registry path. The live project is `bq-wh-nb`, the repo is `stoxx-demo`, and `stoxx-serving` has already moved through multiple same-day tags, with `20260413-6` being the newest tag at the time of capture.

#### PowerShell / Linux | gcloud run jobs list | list the Cloud Run jobs currently bound to those images

**When to run:** After a push, during rollback planning, or when a job appears to be using the wrong code version.
**Trigger:** The registry contains several tags and you need to know which one the platform is actually executing.
**Context:** PowerShell or Linux shell with `gcloud`. This is a read-only control-plane query.
**Purpose:** Bind each live Cloud Run job to its current image reference and latest execution state.

*Shows the current image-to-job bindings in Cloud Run.*

```bash
gcloud run jobs list --project bq-wh-nb --region europe-west1 --format="table(metadata.name,spec.template.spec.template.spec.containers[0].image,status.latestCreatedExecution.name,status.latestCreatedExecution.completionStatus)"
```

```text
NAME               IMAGE                                                                         LATEST_CREATED_EXECUTION_NAME  COMPLETION_STATUS
stoxx-bronze-load  europe-west1-docker.pkg.dev/bq-wh-nb/stoxx-demo/stoxx-bronze-load:20260413-1  stoxx-bronze-load-47gpz        EXECUTION_SUCCEEDED
stoxx-serving      europe-west1-docker.pkg.dev/bq-wh-nb/stoxx-demo/stoxx-serving:20260413-6      stoxx-serving-rtrgv            EXECUTION_RUNNING
stoxx-stage-fetch  europe-west1-docker.pkg.dev/bq-wh-nb/stoxx-demo/stoxx-stage-fetch:20260413-2  stoxx-stage-fetch-4sxtt        EXECUTION_SUCCEEDED
stoxx-transforms   europe-west1-docker.pkg.dev/bq-wh-nb/stoxx-demo/stoxx-transforms:20260413-1   stoxx-transforms-klwrf         EXECUTION_SUCCEEDED
```

This output closes the loop. The registry and the runtime agree on the `bq-wh-nb/stoxx-demo` path, and the currently running `stoxx-serving` job is pinned to `20260413-6`, not to any older repo-era `stoxx-index-intelligence` path.

**Problem:** The repo still contains deployment references to `stoxx-index-intelligence`, but the live deployment estate on April 13, 2026 uses `bq-wh-nb`.
**Context:** Relying on the repo value would point operators at the wrong registry and the wrong deployment project.
**Diagnosis:** The codebase contains stale infrastructure and workflow references from an earlier project identifier.
**Resolution:** This chapter uses the live `bq-wh-nb` registry and job bindings as the current operational truth and treats the repo value as historical drift.
**Validation:** The registry output and the Cloud Run job output both resolve to `europe-west1-docker.pkg.dev/bq-wh-nb/stoxx-demo/...`.
**Prevention rule:** Verify project ID, registry path, and bound runtime image with live `gcloud` queries before documenting or rolling out image changes.

| Flag | Syntax | Description |
|---|---|---|
| `--include-tags` | `gcloud artifacts docker images list ... --include-tags` | Includes tag names instead of returning only digests. |
| `--project` | `gcloud ... --project bq-wh-nb` | Forces the query to the live GCP project. |
| `--region` | `gcloud run jobs list --region europe-west1` | Targets the region that hosts the current Cloud Run jobs. |
| `--format` | `gcloud ... --format="table(...)"` | Projects only the fields needed for operational inspection. |

## Layer And Hygiene Guidance

The live Airflow VM image is useful because it shows what a tightly scoped extension layer looks like. The local workstation is useful because it shows the opposite side of the image-management story: how old images, old tags, volumes, and build cache stay behind unless someone cleans them deliberately.

### Layer Inspection And Build Hygiene

The Airflow VM did not need a completely new image from scratch. It extended the official Airflow 3.2.0 image with a small additional layer that installs provider packages under the matching constraints file. The history output below shows that delta directly.

#### Linux | docker history | inspect the live Airflow image history

**When to run:** After changing the VM Dockerfile, after a failed provider import, or when you need to know whether the custom layer is broad or narrowly scoped.
**Trigger:** The running Airflow containers behave differently from the stock base image and you need to identify what was actually added.
**Context:** Linux shell on `stoxx-airflow`. This is a read-only image inspection.
**Purpose:** Measure the real custom layer on top of the official Airflow base image.

*Shows the top of the live Airflow image history on the VM.*

```bash
gcloud compute ssh stoxx-airflow --project bq-wh-nb --zone europe-west1-b --tunnel-through-iap --command "docker history --no-trunc --human stoxx-airflow:3.2.0"
```

```text
IMAGE                                                                     CREATED    CREATED BY                                                                                                                                                                                                 SIZE
sha256:3b3ecc4b047b2ce26ac6e7335ff54a0a16538d28903b8d1e43d84626e861583b   3 hours ago RUN /bin/bash -o pipefail -o errexit -o nounset -o nolog -c AIRFLOW_VERSION=$(python -c "from airflow import __version__; print(__version__)") ... pip install --no-cache-dir "apache-airflow==${AIRFLOW_VERSION}" -r /tmp/requirements.txt --constraint "${CONSTRAINT_URL}" # buildkit   27.9MB
<missing>                                                                 3 hours ago COPY requirements.txt /tmp/requirements.txt # buildkit                                                                                                                                                     12.3kB
<missing>                                                                 6 days ago  ENTRYPOINT ["/usr/bin/dumb-init" "--" "/entrypoint"]                                                                                                                                                        0B
```

This is a compact and healthy customization pattern. The meaningful project-specific delta is a `27.9MB` `pip install` layer and a tiny `requirements.txt` copy layer. Everything else remains inherited from the official Airflow image, which reduces drift and makes upgrades easier than rebuilding Airflow from scratch.

#### Local | .dockerignore | verify the real build-context boundary on the local host

**When to run:** Before enlarging the build context or after a suspiciously slow local build.
**Trigger:** Build time grows unexpectedly or files appear in the image that should never have been part of the context.
**Context:** File inspection of `C:\Users\aperi\DEV\ESG\.dockerignore`. This is read-only.
**Purpose:** Show which files are intentionally kept out of local builds.

The local `.dockerignore` is doing real work. It excludes Git metadata, Python caches, local data directories, logs, markdown docs, and environment files, which is why the live local build contexts above stayed below one megabyte.

_Shows that the local build context excludes Git metadata, Python caches, runtime data directories, logs, markdown files, and environment files, which is why the recorded BuildKit transfers stayed well under one megabyte._

```text
# Git
.git
.gitignore

# Python
__pycache__
*.pyc
.venv
venv

# Data (fetched at runtime)
data/dimensions
data/ohlcv
data/signals
data/pulse
data/tickers
logs

# Docker
docker-compose.yml
.dockerignore

# Misc
*.md
.env
.env.example
```

This file directly explains the `377B` `.dockerignore` transfer and the small context sizes recorded in the live builds. It also keeps secrets such as `.env` out of the build context, which matters because the raw local `docker compose config` output did interpolate live secret values on the workstation.

| Flag | Syntax | Description |
|---|---|---|
| `--no-trunc` | `docker history --no-trunc <image>` | Prints the full build command instead of clipping it. |
| `--human` | `docker history --human <image>` | Renders layer sizes in readable units such as `27.9MB`. |
| `--project` | `gcloud compute ssh ... --project bq-wh-nb` | Forces the remote image inspection to the live project. |
| `--zone` | `gcloud compute ssh ... --zone europe-west1-b` | Reaches the correct VM zone. |
| `--tunnel-through-iap` | `gcloud compute ssh ... --tunnel-through-iap` | Uses IAP for remote host access. |
| `--command` | `gcloud compute ssh ... --command "<cmd>"` | Runs the image inspection non-interactively on the host. |

## Related

- [[01-container-lifecycle]]
- [[03-docker-compose]]
