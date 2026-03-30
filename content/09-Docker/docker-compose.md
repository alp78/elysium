---
type: concept
category: docker
technology: [docker]
tags: [docker]
aliases: [Docker Compose, docker compose, docker-compose, compose, multi-container, compose file, docker-compose.yaml, docker-compose.yml]
keywords: [docker compose, up, down, build, restart, logs, pull, prune, multi-container, orchestration, services, volumes, detached, scale, exec, run, config, healthcheck, depends_on, networks, env_file, bind mount, named volume, override, force-recreate, rolling update, docker system prune, compose lifecycle, service restart]
description: "Complete Docker Compose reference — compose file structure, lifecycle commands (up/down/start/stop/restart), scaling, logs, exec/debug, config overrides, and cleanup. Includes a full data engineering stack example with Airflow, PostgreSQL, and Redis."
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Docker Compose — Complete Reference

> [!quote]
> "Everyone is looking for a standardized way to build distributed applications."
> — **Solomon Hykes**

Docker Compose defines and runs multi-container applications from a single `docker-compose.yaml` file. For data engineering, this typically means running the [Airflow stack](https://alp78.github.io/elysium/12-Orchestration/Airflow/airflow-deployment) (scheduler, webserver, triggerer) alongside PostgreSQL and Redis, or local development stacks combining databases, pipeline services, and supporting infrastructure. All services, their images, networking, volumes, environment, and startup order are declared in one file and managed with a single CLI. In production, the same service topology often maps to [Cloud Run services](https://alp78.github.io/elysium/07-Terraform/GCP-Resources/terraform-cloud-run) managed by Terraform.

---

## Compose File Structure

### Complete Data Engineering Stack Example

The following `docker-compose.yaml` defines a realistic Airflow + PostgreSQL + Redis stack with all common configuration keys annotated.

```yaml
# docker-compose.yaml — Airflow + PostgreSQL + Redis data engineering stack

# Top-level version key is deprecated as of Compose v2 but still widely seen in older files
# Omit it for new projects; Compose v2+ (docker compose) ignores it gracefully

# ── Named volumes ─────────────────────────────────────────────────────────────
# Volumes declared here are managed by Docker; data persists across container restarts
volumes:
  postgres-db-volume:    # stores PostgreSQL data files
  redis-data:            # stores Redis AOF/RDB persistence files

# ── Networks ──────────────────────────────────────────────────────────────────
# Named networks allow services to communicate by service name (DNS)
networks:
  airflow-net:
    driver: bridge       # default for single-host networking

# ── Services ──────────────────────────────────────────────────────────────────
services:

  # ── PostgreSQL (Airflow metadata database) ──────────────────────────────────
  postgres:
    image: postgres:16-alpine          # image: pull from Docker Hub (no build step)
    restart: unless-stopped            # restart: unless-stopped | always | on-failure | no
    environment:                       # environment: inline key=value pairs
      POSTGRES_USER: airflow
      POSTGRES_PASSWORD: airflow
      POSTGRES_DB: airflow
    env_file:                          # env_file: load additional vars from file
      - .env                           # values here supplement (not replace) environment block
    volumes:
      - postgres-db-volume:/var/lib/postgresql/data   # named volume mount
      - ./initdb:/docker-entrypoint-initdb.d          # bind mount: host_path:container_path
    ports:
      - "5432:5432"                    # host_port:container_port — expose to host
    networks:
      - airflow-net
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "airflow"]
      interval: 10s                    # how often to run the check
      timeout: 5s                      # max wait before marking unhealthy
      retries: 5                       # failed attempts before unhealthy status
      start_period: 30s               # grace period before health checks count

  # ── Redis (Airflow CeleryExecutor broker) ───────────────────────────────────
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis-data:/data
    ports:
      - "6379:6379"
    networks:
      - airflow-net
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ── Airflow Webserver ────────────────────────────────────────────────────────
  airflow-webserver:
    build:                             # build: build image from local Dockerfile
      context: .                       # context: directory sent to Docker daemon
      dockerfile: Dockerfile           # dockerfile: path to Dockerfile (default: Dockerfile)
      args:                            # args: passed as build-time ARGs
        AIRFLOW_VERSION: "2.9.0"
    image: my-airflow:2.9.0            # image: tag the built image with this name
    restart: unless-stopped
    depends_on:                        # depends_on: control startup order
      postgres:
        condition: service_healthy     # wait until healthcheck passes (requires healthcheck block)
      redis:
        condition: service_healthy
    environment:
      AIRFLOW__CORE__EXECUTOR: CeleryExecutor
      AIRFLOW__DATABASE__SQL_ALCHEMY_CONN: postgresql+psycopg2://airflow:airflow@postgres/airflow
      AIRFLOW__CELERY__BROKER_URL: redis://redis:6379/0
      AIRFLOW__WEBSERVER__SECRET_KEY: ${WEBSERVER_SECRET_KEY}   # variable substitution from .env
    env_file:
      - .env
    volumes:
      - ./dags:/opt/airflow/dags               # bind mount: live-reload DAGs from host
      - ./logs:/opt/airflow/logs
      - ./plugins:/opt/airflow/plugins
    ports:
      - "8080:8080"
    command: webserver                          # command: override CMD from Dockerfile
    networks:
      - airflow-net
    deploy:                                    # deploy: resource limits (Compose v2 standalone)
      resources:
        limits:
          cpus: "1.0"                          # max CPU cores
          memory: 2G                           # max RAM
        reservations:
          cpus: "0.5"
          memory: 512M

  # ── Airflow Scheduler ────────────────────────────────────────────────────────
  airflow-scheduler:
    build:
      context: .
      dockerfile: Dockerfile
    image: my-airflow:2.9.0
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      AIRFLOW__CORE__EXECUTOR: CeleryExecutor
      AIRFLOW__DATABASE__SQL_ALCHEMY_CONN: postgresql+psycopg2://airflow:airflow@postgres/airflow
      AIRFLOW__CELERY__BROKER_URL: redis://redis:6379/0
    volumes:
      - ./dags:/opt/airflow/dags
      - ./logs:/opt/airflow/logs
    command: scheduler
    networks:
      - airflow-net

  # ── Airflow Worker (Celery) ──────────────────────────────────────────────────
  airflow-worker:
    build:
      context: .
      dockerfile: Dockerfile
    image: my-airflow:2.9.0
    restart: unless-stopped
    depends_on:
      - airflow-scheduler
    environment:
      AIRFLOW__CORE__EXECUTOR: CeleryExecutor
      AIRFLOW__DATABASE__SQL_ALCHEMY_CONN: postgresql+psycopg2://airflow:airflow@postgres/airflow
      AIRFLOW__CELERY__BROKER_URL: redis://redis:6379/0
    volumes:
      - ./dags:/opt/airflow/dags
      - ./logs:/opt/airflow/logs
    command: celery worker
    entrypoint: ["/usr/local/bin/airflow"]     # entrypoint: override ENTRYPOINT from Dockerfile
    networks:
      - airflow-net
    deploy:
      resources:
        limits:
          cpus: "2.0"
          memory: 4G
```

### Key Compose File Concepts

**Named volumes vs bind mounts**

```yaml
volumes:
  # Named volume — Docker manages storage location; survives container removal
  - postgres-db-volume:/var/lib/postgresql/data

  # Bind mount (absolute host path) — mounts a specific host directory
  - /host/absolute/path:/container/path

  # Bind mount (relative host path) — relative to the compose file location
  - ./dags:/opt/airflow/dags

  # Read-only bind mount — container cannot write to the mounted path
  - ./config:/opt/airflow/config:ro

  # tmpfs — in-memory filesystem, not persisted anywhere
  - type: tmpfs
    target: /tmp/scratch
```

> [!tip] Named Volumes vs Bind Mounts
>
> When to Use Named Volumes vs Bind Mounts.
> Use **named volumes** for database data and other persistent state that Docker should fully manage. Use **bind mounts** for source code, DAGs, and config files you need to edit on the host and have reflected immediately inside the container without a rebuild.

**`restart` policy options**

| Policy | Behavior |
|---|---|
| `no` | Never restart (default) |
| `always` | Always restart, including on Docker daemon restart |
| `unless-stopped` | Restart unless manually stopped; survives daemon restart |
| `on-failure` | Restart only on non-zero exit; optionally `on-failure:3` for max retries |

**`depends_on` conditions**

```yaml
depends_on:
  postgres:
    condition: service_healthy    # wait for healthcheck to pass
  redis:
    condition: service_started    # wait only for container to start (not healthy) — default
  migrations:
    condition: service_completed_successfully  # wait for a one-shot container to exit 0
```

> [!danger] depends_on Needs service_healthy
>
> `depends_on` Without `service_healthy` Causes Silent Startup Failures.
> `service_started` only waits for the container process to start, not for the application inside to be ready. If Airflow starts before PostgreSQL finishes initialization, the scheduler crashes with a connection error, enters a restart loop, and the logs fill with misleading "database does not exist" errors. Always use `condition: service_healthy` with a `healthcheck` that verifies the service is actually accepting connections.

**Network configuration**

```yaml
networks:
  # Default bridge network — services on the same network resolve each other by service name
  airflow-net:
    driver: bridge

  # Attach a service to multiple networks
  services:
    app:
      networks:
        - airflow-net
        - monitoring-net

  # Use an externally created network (not managed by this compose file)
  networks:
    shared-net:
      external: true
      name: my-preexisting-network
```

---

### Environment Variable Substitution

Compose substitutes `${VAR}` and `$VAR` references from three sources, in priority order (the same [environment variable patterns](https://alp78.github.io/elysium/01-Shell/Scripting/environment-variables) used throughout shell scripting and CI):

1. Shell environment variables (highest priority)
2. `.env` file in the same directory as the compose file
3. `environment` block defaults

```yaml
# docker-compose.yaml
services:
  app:
    image: myapp:${APP_VERSION:-latest}   # use APP_VERSION, default to "latest" if unset
    environment:
      DB_HOST: ${DB_HOST}
      LOG_LEVEL: ${LOG_LEVEL:-INFO}       # inline default with :-
```

```bash
# .env — loaded automatically by docker compose; never commit secrets to git
APP_VERSION=2.9.0
DB_HOST=postgres
LOG_LEVEL=DEBUG
WEBSERVER_SECRET_KEY=changeme-use-a-real-secret
```

> [!danger] Auto-Loaded .env File Risk
>
> `.env` Files Are Loaded Automatically and Often Leaked.
> `docker compose` silently loads `.env` from the compose file's directory -- even if you did not specify `env_file`. If this file contains production secrets and gets committed to git, the credentials are exposed in git history permanently. Add `.env` to `.gitignore` on day one. For production, use a secrets manager (GCP Secret Manager, Vault) and inject values via CI/CD -- never store production credentials in `.env` files on disk.

> [!tip] Related pattern
>
> The `env_file` and `environment` directives here mirror the [shell environment variable](https://alp78.github.io/elysium/01-Shell/Scripting/environment-variables) conventions. In CI/CD, GitHub Actions injects these same values through secrets and `env:` blocks rather than `.env` files.

---

## Lifecycle Commands

### Starting Services

```bash
# Start all services in detached mode (background)
docker compose up -d
# -d / --detach: run containers in the background; print container names and exit

# Start a specific service only (and its dependencies via depends_on)
docker compose up -d airflow-webserver

# Rebuild images before starting (after Dockerfile or requirements change)
docker compose up -d --build

# Rebuild a specific service only
docker compose up -d --build airflow-scheduler

# Force recreate containers even if config is unchanged
docker compose up -d --force-recreate
# Useful when an image was rebuilt outside compose (e.g., docker build manually)

# Force recreate a specific service
docker compose up -d --force-recreate airflow-worker

# Combine: rebuild AND force recreate
docker compose up -d --build --force-recreate airflow-webserver
```

> [!info] up vs start
>
> `up` vs `start`.
> `docker compose up` creates containers if they don't exist, then starts them. `docker compose start` only starts existing stopped containers — it cannot create new ones.

### Stopping Services

```bash
# Stop and remove containers and networks (volumes are preserved)
docker compose down
# This is the standard "tear down" — safe to run repeatedly

# Stop and remove containers, networks, AND named volumes — data will be lost
docker compose down -v
# -v / --volumes: also remove named volumes declared in the volumes section

# Stop and remove containers, networks, AND all images used by services
docker compose down --rmi all
# --rmi all: removes all images; --rmi local: removes only locally built images

# Nuclear option: remove everything
docker compose down -v --rmi all

# Stop containers WITHOUT removing them (preserves container state)
docker compose stop

# Stop a specific service without removing it
docker compose stop airflow-scheduler
```

> [!warning] down -v Deletes All Volumes
>
> `docker compose down -v` is Destructive.
> This deletes all named volumes — including your database data. Run `docker compose down` (without `-v`) when you just want to stop the stack. Only use `-v` when you explicitly want to wipe state and start fresh.

### Starting and Restarting

```bash
# Start previously stopped containers (does not create new ones)
docker compose start

# Start a specific stopped service
docker compose start postgres

# Restart all services (stop + start in sequence)
docker compose restart

# Restart a specific service
docker compose restart airflow-scheduler
# Common workflow after editing a DAG that requires a scheduler reload

# Pause all services (freeze processes, keep memory state)
docker compose pause

# Unpause all services (resume from frozen state)
docker compose unpause

# Pause a specific service
docker compose pause airflow-worker
```

---

### Scaling and Individual Service Management

```bash
# Scale a service to N replicas at startup
docker compose up -d --scale airflow-worker=3
# Starts 3 instances of airflow-worker; ports must not be published (conflicts)
# Named containers will be: airflow-worker-1, airflow-worker-2, airflow-worker-3

# Scale down while the stack is running
docker compose up -d --scale airflow-worker=1
# Compose removes the extra containers gracefully

# Rebuild and restart a single service without touching others
docker compose up -d --build --force-recreate airflow-scheduler
# Equivalent to: stop → remove → rebuild image → create → start — for that service only

# Pull a new image and restart a single service (for pre-built images)
docker compose pull postgres && docker compose up -d --force-recreate postgres
```

> [!warning] Scaling with Published Ports
>
> Scaling Services with Published Ports.
> If a service has `ports: - "5432:5432"`, you cannot scale it beyond 1 replica — only one process can bind to host port 5432. Remove the `ports` key or use host-port 0 (dynamic assignment) before scaling.

---

### Logs and Monitoring

```bash
# Stream logs from all services (most recent 50 lines, then follow)
docker compose logs -f --tail 50
# -f / --follow: stream new log lines as they arrive
# --tail N: start from the last N lines (default: all)

# Stream logs from specific services only
docker compose logs -f airflow-scheduler airflow-worker

# View logs without following (dump and exit)
docker compose logs --tail 100 postgres

# Show timestamps on each log line
docker compose logs -f --timestamps airflow-webserver

# Show running processes inside each container (like top, per service)
docker compose top

# Show processes for a specific service
docker compose top airflow-scheduler

# Show status of all services (running, stopped, ports)
docker compose ps

# Show only service names (useful in scripts)
docker compose ps --services

# Show only running services
docker compose ps --status running
```

---

## Updating Images (Rolling Updates)

```bash
# Pull latest versions of all images declared with a tag
docker compose pull
# Downloads updated layers; does not restart containers

# Pull a specific service's image
docker compose pull postgres

# Apply updates: recreate containers with the newly pulled images
docker compose up -d
# Compose detects the new image digest and recreates only changed containers

# Explicit pull-then-recreate for a single service (safest pattern)
docker compose pull airflow-webserver
docker compose up -d --force-recreate airflow-webserver
```

#### Safe rolling update pattern for production-like stacks

```bash
# 1. Pull new images while stack is running (no downtime yet)
docker compose pull

# 2. Review what changed
docker compose images   # shows current images and digests per service

# 3. Recreate services one at a time to minimize downtime
docker compose up -d --force-recreate postgres
docker compose up -d --force-recreate redis
docker compose up -d --force-recreate airflow-webserver airflow-scheduler
```

---

### Exec and Debug

```bash
# Open an interactive shell inside a running container
docker compose exec airflow-webserver bash
# exec runs inside the EXISTING running container (no new container created)

# Run a single command inside a running container (non-interactive)
docker compose exec postgres psql -U airflow -d airflow -c "\dt"

# Run airflow CLI commands inside the webserver container
docker compose exec airflow-webserver airflow dags list
docker compose exec airflow-webserver airflow tasks test my_dag my_task 2024-01-01

# Specify user for exec (useful when container runs as non-root)
docker compose exec --user root airflow-webserver bash

# Run a one-off command in a NEW container based on the service image
docker compose run --rm airflow-webserver airflow db migrate
# --rm: remove the temporary container after the command exits
# run creates a new container; exec uses an existing running one

# Run with a different entry point
docker compose run --rm --entrypoint bash airflow-webserver

# Copy files between host and container
docker compose cp airflow-webserver:/opt/airflow/logs/scheduler ./local-logs
docker compose cp ./my-config.cfg airflow-webserver:/opt/airflow/
```

> [!tip] exec vs run
>
> `exec` vs `run`.
> Use `exec` to interact with an already-running service (most common — checking logs, running admin commands). Use `run` for one-off tasks like database migrations or initialization scripts, especially when the service is not yet started.

---

## Configuration: Validation and Overrides

### Validate and Inspect Resolved Config

```bash
# Validate the compose file and print the fully resolved configuration
docker compose config
# Expands all variable substitutions, merges override files, and validates syntax
# Excellent for debugging why a service isn't picking up the right environment vars

# Print only service names
docker compose config --services

# Print only volume names
docker compose config --volumes
```

### Multiple Compose Files (Overrides)

Compose merges multiple files in order. Later files override earlier ones — useful for separating base config from environment-specific overrides.

```bash
# Merge base + override files
docker compose -f docker-compose.yaml -f docker-compose.override.yaml up -d

# Common pattern: base + production overrides
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml up -d

# Common pattern: base + local dev overrides
docker compose -f docker-compose.yaml -f docker-compose.dev.yaml up -d
```

```yaml
# docker-compose.override.yaml — automatically loaded if present alongside docker-compose.yaml
# Override specific keys without duplicating the full service definition

services:
  airflow-webserver:
    ports:
      - "8080:8080"       # expose to host in dev; omit in prod
    environment:
      AIRFLOW__CORE__DAGS_ARE_PAUSED_AT_CREATION: "false"
    volumes:
      - ./dags:/opt/airflow/dags   # bind mount DAGs for live reload in dev

  postgres:
    ports:
      - "5432:5432"       # expose DB port to host in dev for direct access
```

> [!info] Automatic Override Loading
>
> If a file named `docker-compose.override.yaml` exists alongside `docker-compose.yaml`, Compose loads and merges it automatically. You don't need the `-f` flag. Rename it to `docker-compose.dev.yaml` if you want explicit control over when it applies.

### Project Name

```bash
# Set project name (default: directory name — used as prefix on container/network/volume names)
docker compose -p myproject up -d
# Container names become: myproject-postgres-1, myproject-airflow-webserver-1, etc.

# Or set via environment variable
COMPOSE_PROJECT_NAME=myproject docker compose up -d
```

---

### Cleanup and Disk Management

```bash
# Remove stopped containers, dangling images, unused networks, and build cache
docker system prune -f
# -f / --force: skip confirmation prompt
# Safe to run regularly — only removes unused resources

# Also remove unused volumes (adds to prune scope)
docker system prune -f --volumes
# ⚠️ This is the same as docker volume prune — removes volumes not attached to any container

# Remove only unused volumes
docker volume prune -f

# Remove only dangling images (untagged layers from old builds)
docker image prune -f

# Remove ALL unused images (not just dangling — includes tagged images with no running container)
docker image prune -af

# Show disk usage breakdown: images, containers, volumes, build cache
docker system df

# Verbose disk usage with per-item details
docker system df -v
```

> [!warning] Volume Pruning
>
> `docker volume prune` removes ALL volumes not currently mounted by at least one container. If your database container is stopped (but not removed), its volume is still "in use" — but if the container was removed (via `docker compose down`), the volume becomes "unused" and will be deleted. Always run `docker compose down` (without `-v`) instead of letting volumes accumulate for pruning.

> [!tip] Routine Cleanup Pattern
>
> After tearing down a dev stack you no longer need:
> ```bash
> docker compose down          # remove containers and networks; keep volumes
> docker system prune -f       # clean dangling images, stopped containers, unused networks
> # Only add --volumes if you confirmed you don't need the data
> ```

---

### Quick Reference Summary

| Task | Command |
|---|---|
| Start all (background) | `docker compose up -d` |
| Start and rebuild | `docker compose up -d --build` |
| Start specific service | `docker compose up -d postgres` |
| Force recreate | `docker compose up -d --force-recreate` |
| Stop and remove | `docker compose down` |
| Stop + remove volumes | `docker compose down -v` |
| Stop without removing | `docker compose stop` |
| Start stopped containers | `docker compose start` |
| Restart all | `docker compose restart` |
| Restart one service | `docker compose restart airflow-scheduler` |
| Pause / unpause | `docker compose pause` / `docker compose unpause` |
| Scale service | `docker compose up -d --scale worker=3` |
| Stream all logs | `docker compose logs -f --tail 50` |
| Stream specific logs | `docker compose logs -f service1 service2` |
| Service status | `docker compose ps` |
| Process list | `docker compose top` |
| Shell into container | `docker compose exec service bash` |
| Run one-off command | `docker compose run --rm service cmd` |
| Pull updated images | `docker compose pull` |
| Validate config | `docker compose config` |
| Multi-file merge | `docker compose -f base.yaml -f override.yaml up -d` |
| Disk usage | `docker system df` |
| Prune unused resources | `docker system prune -f` |
| Prune volumes | `docker volume prune -f` |

---

## Related

- [container-lifecycle](https://alp78.github.io/elysium/09-Docker/container-lifecycle) — Individual container operations (docker run, stop, rm, inspect)
- [image-management](https://alp78.github.io/elysium/09-Docker/image-management) — Building and pushing Docker images
- [docker-cheat-sheet](https://alp78.github.io/elysium/09-Docker/docker-cheat-sheet) — Full docker CLI quick reference
- the Airflow DAGs — Airflow runs via Docker Compose on the Airflow VM
