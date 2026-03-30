---
type: concept
category: docker
technology: [docker, gcp]
tags: [docker, gcp]
aliases:
  - Docker images
  - docker build
  - docker push
  - docker pull
  - docker tag
  - multi-stage build
  - Artifact Registry
  - Dockerfile instructions
  - docker image prune
  - docker history
  - docker inspect
  - build cache
  - image layers
  - .dockerignore
  - slim base image
  - alpine image
keywords:
  - docker
  - image
  - build
  - tag
  - push
  - pull
  - multi-stage
  - artifact registry
  - dockerfile
  - layer
  - size
  - registry
  - pipeline image
  - FROM
  - RUN
  - COPY
  - ADD
  - WORKDIR
  - ENV
  - ARG
  - EXPOSE
  - CMD
  - ENTRYPOINT
  - build context
  - no-cache
  - build-arg
  - target stage
  - platform
  - linux/amd64
  - M1 Mac
  - docker hub
  - ECR
  - dangling image
  - docker system prune
  - docker system df
  - image size optimization
  - layer caching
  - slim
  - alpine
description: "Comprehensive Docker image management reference — Dockerfile instructions, building with cache and multi-stage patterns, tagging strategies, pushing to GCP Artifact Registry, inspecting layers and size, and cleaning up disk usage."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Image Management

Docker images are the immutable, layered artifacts that run as [containers](https://alp78.github.io/elysium/09-Docker/container-lifecycle). For data engineering pipelines, you build images locally or in [CI/CD](https://alp78.github.io/elysium/10-GitHub-Actions/github-actions-workflows), push them to [Artifact Registry](https://alp78.github.io/elysium/07-Terraform/GCP-Resources/terraform-registry-and-ci), and deploy to [Cloud Run](https://alp78.github.io/elysium/06-GCP/Serverless/cloud-run-jobs-vs-services) or the Airflow DAGs. Understanding how images are built, layered, and sized is essential for fast deploys and low costs.

---

## Dockerfile Fundamentals

A `Dockerfile` is a sequential list of instructions. Each instruction that modifies the filesystem creates a new **layer** — a read-only diff on top of the previous layer. Layers are cached and reused across builds, which is why instruction order matters.

### Key Instructions

**FROM** — Sets the base image. Always the first instruction.
```dockerfile
FROM python:3.12-slim
# Use a specific digest for fully reproducible builds
FROM python:3.12-slim@sha256:abc123...
```

**WORKDIR** — Sets the working directory for subsequent instructions. Creates the directory if it does not exist. Prefer this over `RUN mkdir && cd`.
```dockerfile
WORKDIR /app
# All COPY, RUN, CMD instructions now execute relative to /app
```

**ENV** — Sets environment variables available at build time AND runtime.
```dockerfile
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
# PYTHONDONTWRITEBYTECODE: skip .pyc files (saves space)
# PYTHONUNBUFFERED: force stdout/stderr flush (essential for Cloud Run logs)
```

**ARG** — Sets build-time variables only (not available at runtime). Used with `--build-arg` at `docker build`.
```dockerfile
ARG APP_VERSION=0.0.1
ARG PIP_INDEX_URL
# ARG values do not persist into the final image
```

**COPY** — Copies files from build context into the image. Preferred over ADD for local files.
```dockerfile
COPY requirements.txt .
COPY src/ /app/src/
```

**ADD** — Like COPY but also handles remote URLs and automatically extracts tar archives. Only use ADD when you specifically need tar extraction; use COPY for everything else.
```dockerfile
# Valid ADD use: extract a local tar
ADD archive.tar.gz /app/
# Avoid: use COPY for ordinary files
```

**RUN** — Executes a shell command and commits the result as a new layer.
```dockerfile
# Combine into a single RUN to minimize layers
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*
# rm -rf /var/lib/apt/lists/* removes the package index — critical for slim images
```

**EXPOSE** — Documents which port the container listens on. Informational only — does not actually publish the port (that happens at `docker run -p`).
```dockerfile
EXPOSE 8080
```

**CMD** — Provides the default command when the container starts. Can be overridden at `docker run`. Only the last CMD in a Dockerfile takes effect.
```dockerfile
CMD ["python", "-m", "pipeline.run"]
```

**ENTRYPOINT** — Sets the fixed executable. Unlike CMD, it is not overridden by arguments to `docker run` (only by `--entrypoint`).
```dockerfile
ENTRYPOINT ["gunicorn", "--bind", "0.0.0.0:8080"]
```

### CMD vs ENTRYPOINT

| | CMD | ENTRYPOINT |
|---|---|---|
| Purpose | Default command, easily overridden | Fixed executable |
| Override with `docker run args` | Yes — args replace CMD entirely | No — args are appended to ENTRYPOINT |
| Override with `docker run --entrypoint` | N/A | Yes |
| Typical use | Scripts, batch jobs, development containers | Servers, CLI wrappers, distroless images |

**Combined pattern** — ENTRYPOINT provides the executable, CMD provides default arguments:
```dockerfile
ENTRYPOINT ["python", "-m", "pipeline"]
CMD ["--env", "prod"]
# docker run myimage                   → python -m pipeline --env prod
# docker run myimage --env staging     → python -m pipeline --env staging
# docker run --entrypoint bash myimage → bash (ignores CMD)
```

> [!tip] Rule of Thumb
>
> Use CMD for pipeline/batch containers where you want easy overrides. Use ENTRYPOINT for server containers or when the executable must always be the same. When in doubt, use CMD — it is more flexible.

### .dockerignore

The `.dockerignore` file excludes files from the **build context** — the directory Docker sends to the daemon at build time. Excluding unnecessary files speeds up builds and prevents secrets from leaking into images.

#### Python project `.dockerignore`
```text
# Version control
.git
.gitignore

# Python artifacts
__pycache__
*.pyc
*.pyo
*.pyd
.Python
*.egg-info
dist
build
*.egg

# Virtual environments
.venv
venv
env
.env

# Testing and coverage
.pytest_cache
.mypy_cache
.coverage
htmlcov
.tox

# IDE and OS files
.DS_Store
.idea
.vscode
*.swp
Thumbs.db
desktop.ini

# Docs and local config
docs
*.md
.dockerignore
docker-compose*.yml

# Secrets (never let these into an image)
.env
*.pem
*.key
credentials.json
service-account.json
```

> [!warning] Secrets in Build Context
>
> Any file in the build context can end up in the image if a `COPY . .` instruction is used. Always add credential files to `.dockerignore`. Use `docker history` to verify no secrets were baked in.

### Build Context

The build context is the directory argument at the end of `docker build` (usually `.`). Docker tars the entire directory and sends it to the daemon before the build starts. A large build context (e.g., a directory with 500MB of data files) dramatically slows every build, even if those files are never COPYed into the image.

```bash
# Build with current directory as context
docker build -t myimage .

# Build with a specific context directory
docker build -t myimage -f path/to/Dockerfile ./src

# Build with no context at all (Dockerfile only)
docker build -t myimage - < Dockerfile
```

---

## Building Images

### Core Build Command

```bash
# Standard build: tag as name:tag, Dockerfile in current directory
docker build -t data-pipeline-pipeline:latest .

# Specify a different Dockerfile location
docker build -t data-pipeline-pipeline:latest -f docker/Dockerfile.prod .
```

### Useful Build Flags

```bash
# Force a completely fresh build — ignores all cached layers
docker build --no-cache -t data-pipeline-pipeline:latest .

# Pass a build-time variable defined by ARG in the Dockerfile
docker build --build-arg APP_VERSION=1.2.3 -t data-pipeline-pipeline:1.2.3 .

# Build only up to a named stage (useful for debugging intermediate stages)
docker build --target builder -t data-pipeline-pipeline:debug .

# Build for a specific platform (critical for M1/M2 Macs deploying to GCP Cloud Run)
docker build --platform linux/amd64 -t data-pipeline-pipeline:latest .
# GCP Cloud Run and most GCP services run on linux/amd64
# Without this flag, an M1 Mac produces a linux/arm64 image that fails on GCP
```

> [!warning] M1/M2 Mac + GCP
>
> If you build on Apple Silicon without `--platform linux/amd64`, the image will be `linux/arm64`. Cloud Run will refuse it with a cryptic error. Always set the platform when building for GCP.

### Build Cache and Layer Optimization

Docker caches every layer. When a layer's instruction changes — or any layer above it changes — Docker invalidates the cache for that layer and all layers below it. **Order instructions from least-frequently-changed to most-frequently-changed.**

```dockerfile
# BAD: Copying all source first means every code change invalidates the pip install layer
FROM python:3.12-slim
COPY . /app
RUN pip install -r /app/requirements.txt   # ← Cache miss on every code change

# GOOD: Dependencies change less often than code
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .                    # ← Only invalidated when requirements.txt changes
RUN pip install -r requirements.txt        # ← Cached on every code-only change
COPY src/ .                                # ← Code last
CMD ["python", "main.py"]
```

> [!tip] Cache-Busting Strategy
>
> If you need to force a fresh pip install without `--no-cache` (e.g., to pick up a patched transitive dependency), bump the requirements file with a comment line, or use `--build-arg CACHE_DATE=$(date +%Y-%m-%d)` with a corresponding `ARG CACHE_DATE` in the Dockerfile.

---

## Multi-Stage Builds

Multi-stage builds use multiple `FROM` instructions in a single Dockerfile. The final image only contains what is explicitly copied from previous stages — all build tools, compilers, and caches are discarded.

```dockerfile
# Stage 1: Builder — has build tools, creates compiled artifacts
FROM python:3.12-slim AS builder
WORKDIR /install
COPY requirements.txt .
# Install into /install prefix so it can be copied cleanly
RUN pip install --prefix=/install --no-cache-dir -r requirements.txt

# Stage 2: Runtime — minimal, no build tools
FROM python:3.12-slim AS runtime
WORKDIR /app

# Copy only the installed packages from the builder stage
COPY --from=builder /install /usr/local

# Copy only the application source
COPY pipeline/ /app/pipeline/

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

CMD ["python", "-m", "pipeline.run"]

# Result: runtime image is ~200MB instead of ~1.5GB
# The builder stage (with gcc, wheel cache, etc.) is discarded entirely
```

**Why layers matter here:** without multi-stage, a single `pip install` on a slim image still leaves behind the wheel build cache and any C-extension build dependencies pulled in by pip. Multi-stage is the only way to guarantee those artifacts never appear in the final image.

#### Build a specific stage for debugging
```bash
# Build only the builder stage to inspect installed packages
docker build --target builder -t data-pipeline-pipeline:debug .
docker run --rm data-pipeline-pipeline:debug pip list
```

> [!tip] Image Size Matters
>
> Smaller images mean faster pulls, faster cold starts on [Cloud Run](https://alp78.github.io/elysium/06-GCP/Serverless/cloud-run-jobs-vs-services), and lower storage costs in [Artifact Registry](https://alp78.github.io/elysium/07-Terraform/GCP-Resources/terraform-registry-and-ci). A 200MB image pulls in ~3 seconds on Cloud Run; a 1.5GB image takes 30+ seconds on cold start.

---

## Tagging

### docker tag

`docker tag` creates an additional name for an existing image. It does not copy or duplicate the image — both names point to the same image ID.

```bash
# Retag a local image before pushing to a registry
docker tag data-pipeline-pipeline:latest europe-west1-docker.pkg.dev/data-platform-prod/pipeline/data-pipeline-pipeline:latest

# Retag with a git SHA (immutable, traceable)
docker tag data-pipeline-pipeline:latest europe-west1-docker.pkg.dev/data-platform-prod/pipeline/data-pipeline-pipeline:$(git rev-parse --short HEAD)
```

### Tagging Strategies

| Strategy | Example | Use Case |
|---|---|---|
| `latest` | `myimage:latest` | Local dev only |
| Git SHA | `myimage:a3f1c9d` | CI/CD — immutable, traceable |
| Semantic version | `myimage:1.4.2` | Libraries, stable APIs |
| Date-based | `myimage:20260322` | Scheduled batch jobs |
| Branch + SHA | `myimage:main-a3f1c9d` | Multi-branch CI |

> [!warning] latest Tag Is Dangerous
>
> Why `latest` is Dangerous in Production.
> `latest` is mutable — it points to whatever was pushed last. Two deployments using `latest` may run different code if someone pushed between them. In Cloud Run job definitions, Terraform, or Kubernetes manifests, always pin to an immutable tag (git SHA or semantic version). Use `latest` only for local development and quick tests.

---

## Registry Operations

### Authenticate to Registries

```bash
# Docker Hub (default registry)
docker login
# Prompts for username and password / access token

# Docker Hub with explicit credentials (for CI/CD)
echo "$DOCKER_TOKEN" | docker login --username "$DOCKER_USER" --password-stdin

# GCP Artifact Registry — configure Docker to use gcloud credentials
gcloud auth configure-docker europe-west1-docker.pkg.dev
# Run this once per machine; updates ~/.docker/config.json

# GCP Artifact Registry in CI/CD (using a service account key)
echo "$GCP_SA_KEY" | docker login -u _json_key --password-stdin https://europe-west1-docker.pkg.dev
```

### Push and Pull

```bash
# Push an image to Artifact Registry
docker push europe-west1-docker.pkg.dev/data-platform-prod/pipeline/data-pipeline-pipeline:latest

# Pull an image from Artifact Registry
docker pull europe-west1-docker.pkg.dev/data-platform-prod/pipeline/data-pipeline-pipeline:a3f1c9d

# Pull from Docker Hub (implicit registry)
docker pull python:3.12-slim
```

### Registry Comparison

| Registry | Best For | Auth Method | Cost |
|---|---|---|---|
| Docker Hub | Public base images, open source | docker login | Free tier limited |
| GCP Artifact Registry | Private images in GCP projects | gcloud / SA key | Pay per GB stored + egress |
| AWS ECR | Private images in AWS | aws ecr get-login-password | Pay per GB stored |
| GitHub Container Registry | Images in GitHub Actions CI | GITHUB_TOKEN | Free for public, included in Actions minutes |

> [!tip] Artifact Registry vs Container Registry
>
> GCP deprecated Container Registry (`gcr.io`) in favor of Artifact Registry (`pkg.dev`). All new projects should use Artifact Registry. See [terraform-registry-and-ci](https://alp78.github.io/elysium/07-Terraform/GCP-Resources/terraform-registry-and-ci) for Terraform configuration.

---

## Listing and Inspecting Images

### List Images

```bash
# List all local images with default columns
docker images

# Equivalent command
docker image ls

# Filter by repository name
docker images data-pipeline-pipeline

# Show all images including intermediate layers
docker images -a

# Custom format: name:tag and size, sorted by size
docker images --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}" | sort -k2 -h

# Show only image IDs (useful for scripting)
docker images -q

# Show dangling images (untagged layers left over from rebuilds)
docker images -f dangling=true
```

### Inspect an Image

```bash
# Full JSON metadata: layers, config, environment, entrypoint, exposed ports
docker image inspect data-pipeline-pipeline:latest

# Extract a specific field with Go template
docker image inspect data-pipeline-pipeline:latest --format '{{.Config.Cmd}}'
docker image inspect data-pipeline-pipeline:latest --format '{{.Config.Env}}'

# Show total size of the image
docker image inspect data-pipeline-pipeline:latest --format '{{.Size}}' | numfmt --to=iec
```

### See Layer History and Sizes

```bash
# Show every layer: instruction that created it and its size contribution
docker history data-pipeline-pipeline:latest

# Human-readable sizes, no truncation of long commands
docker history --no-trunc --human data-pipeline-pipeline:latest

# Compact view showing only non-zero-size layers
docker history data-pipeline-pipeline:latest | awk '$4 != "0B"'
```

> [!tip] Debugging Large Images
>
> Run `docker history` to find which layer is eating the most space. A large RUN layer usually means a package manager cache was not cleaned up in the same RUN instruction. Because each `RUN` is a separate layer, a subsequent `RUN rm -rf /var/lib/apt/lists/*` does NOT reduce the image size — the original layer still exists. The cleanup must be in the same `RUN` as the install.

---

## Image Size Optimization

### Use Slim or Alpine Base Images

```dockerfile
# Full Python image: ~1.0GB
FROM python:3.12

# Slim variant (Debian, minimal packages): ~130MB
FROM python:3.12-slim

# Alpine variant (musl libc, busybox): ~50MB base
FROM python:3.12-alpine
# Warning: Alpine uses musl libc instead of glibc; some C extensions
# (numpy, pandas, psycopg2) require compilation or special wheels.
# Test thoroughly before using alpine for data science workloads.
```

### Minimize Layers — Combine RUN Instructions

```dockerfile
# BAD: Three separate RUN layers, apt cache kept in layer 1
RUN apt-get update
RUN apt-get install -y curl git
RUN rm -rf /var/lib/apt/lists/*

# GOOD: Single layer, cache removed in the same instruction
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl git \
    && rm -rf /var/lib/apt/lists/*
# --no-install-recommends skips optional dependencies
```

### Multi-Stage Builds

See the [Multi-Stage Builds](#multi-stage-builds) section above. This is the single highest-impact optimization.

### .dockerignore

Excluding large directories from the build context prevents them from being accidentally COPYed. See the [.dockerignore](#dockerignore) section above.

### Order Instructions by Change Frequency

Put the instructions that change least often (base image, system deps, pip install) at the top. Put the instructions that change most often (application source code) at the bottom. This maximizes layer cache hits.

```dockerfile
FROM python:3.12-slim                   # changes: almost never
WORKDIR /app
RUN apt-get update && apt-get install --no-install-recommends -y \
    libpq-dev && rm -rf /var/lib/apt/lists/*    # changes: rarely
COPY requirements.txt .                 # changes: occasionally
RUN pip install --no-cache-dir -r requirements.txt  # changes: when requirements.txt changes
COPY src/ .                             # changes: every commit
CMD ["python", "main.py"]
```

### pip Flags for Smaller Installs

```dockerfile
# --no-cache-dir: do not write pip's HTTP cache to disk
# --no-compile: skip generating .pyc files at install time
# (set PYTHONDONTWRITEBYTECODE=1 to suppress .pyc at runtime)
RUN pip install --no-cache-dir --no-compile -r requirements.txt
```

### Summary: Size Reduction Checklist

- [ ] Use `python:3.12-slim` (not `python:3.12`)
- [ ] Multi-stage build to discard build tools
- [ ] Combine `apt-get update` + install + cleanup in a single `RUN`
- [ ] `--no-install-recommends` on apt-get
- [ ] `--no-cache-dir` on pip
- [ ] `.dockerignore` excludes venv, `__pycache__`, data files, docs
- [ ] Source code copied last (after dependencies)

---

## Cleanup

### Remove Dangling Images

Dangling images are untagged layers produced when you rebuild an image with the same tag. They consume disk space silently.

```bash
# Show dangling images
docker images -f dangling=true

# Remove all dangling images
docker image prune
# Prompts for confirmation; add -f to skip

# Remove ALL unused images (not just dangling — any image not used by a running container)
docker image prune -a
```

### Targeted Removal

```bash
# Remove a specific image by name:tag
docker rmi data-pipeline-pipeline:latest

# Remove by image ID
docker rmi a1b2c3d4e5f6

# Force remove even if a stopped container references it
docker rmi -f data-pipeline-pipeline:old-tag

# Remove multiple images at once
docker rmi data-pipeline-pipeline:1.0 data-pipeline-pipeline:1.1
```

### System-Wide Cleanup

```bash
# Show disk usage broken down by images, containers, volumes, build cache
docker system df

# Verbose breakdown — shows individual items and their sizes
docker system df -v

# Remove ALL unused Docker objects: stopped containers, dangling images,
# unused networks, and dangling build cache
docker system prune

# Also remove unused volumes (data loss risk — be careful)
docker system prune --volumes

# Remove everything including unused (not just dangling) images — the nuclear option
docker system prune -a
# Useful before a demo or after a period of heavy experimentation
```

> [!warning] System Prune Deletes Everything
>
> docker system prune -a.
> This removes every image not referenced by a running container, including base images you pulled but are not actively using. Your next build will re-pull them. Only run this when you explicitly want to reclaim maximum disk space and are prepared for slower next builds.

---

### Full Workflow: Local Build to Artifact Registry

```bash
# 1. Authenticate (one-time setup per machine)
gcloud auth configure-docker europe-west1-docker.pkg.dev

# 2. Build for the target platform (linux/amd64 for GCP)
docker build \
  --platform linux/amd64 \
  --no-cache \
  --build-arg APP_VERSION=$(git rev-parse --short HEAD) \
  -t data-pipeline-pipeline:$(git rev-parse --short HEAD) \
  -f Dockerfile \
  .

# 3. Tag with the full Artifact Registry path
docker tag data-pipeline-pipeline:$(git rev-parse --short HEAD) \
  europe-west1-docker.pkg.dev/data-platform-prod/pipeline/data-pipeline-pipeline:$(git rev-parse --short HEAD)

# 4. Also tag as latest for convenience
docker tag data-pipeline-pipeline:$(git rev-parse --short HEAD) \
  europe-west1-docker.pkg.dev/data-platform-prod/pipeline/data-pipeline-pipeline:latest

# 5. Push both tags
docker push europe-west1-docker.pkg.dev/data-platform-prod/pipeline/data-pipeline-pipeline:$(git rev-parse --short HEAD)
docker push europe-west1-docker.pkg.dev/data-platform-prod/pipeline/data-pipeline-pipeline:latest

# 6. Verify push and inspect the remote image
docker image inspect europe-west1-docker.pkg.dev/data-platform-prod/pipeline/data-pipeline-pipeline:latest
```

In CI/CD, steps 2-5 are handled by [GitHub Actions](https://alp78.github.io/elysium/10-GitHub-Actions/github-actions-workflows), which authenticate to GCP via Workload Identity Federation and push to Artifact Registry in a single workflow. The git SHA tag is the canonical production reference used in [Terraform Cloud Run job definitions](https://alp78.github.io/elysium/07-Terraform/GCP-Resources/terraform-registry-and-ci). Once pushed, [Cloud Run](https://alp78.github.io/elysium/07-Terraform/GCP-Resources/terraform-cloud-run) pulls the image directly from Artifact Registry at deploy time.

---

## Related

- [container-lifecycle](https://alp78.github.io/elysium/09-Docker/container-lifecycle) — Running containers from images (create, start, exec, logs, stop)
- [docker-compose](https://alp78.github.io/elysium/09-Docker/docker-compose) — Multi-container orchestration with docker-compose.yml
- [docker-cheat-sheet](https://alp78.github.io/elysium/09-Docker/docker-cheat-sheet) — Quick reference for the most common Docker commands
- [github-actions-workflows](https://alp78.github.io/elysium/10-GitHub-Actions/github-actions-workflows) — CI/CD pipelines that build and push images automatically
- [terraform-registry-and-ci](https://alp78.github.io/elysium/07-Terraform/GCP-Resources/terraform-registry-and-ci) — Artifact Registry Terraform configuration and Cloud Run job definitions
- [cloud-run-jobs-vs-services](https://alp78.github.io/elysium/06-GCP/Serverless/cloud-run-jobs-vs-services) — Where images are deployed and how cold start time relates to image size
- the Airflow DAGs — Airflow deployment that pulls pipeline images from Artifact Registry
