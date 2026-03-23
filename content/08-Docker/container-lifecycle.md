---
type: concept
category: docker
technology: [docker]
tags: [docker]
aliases: [container lifecycle, docker ps, docker logs, docker exec, docker stats, docker inspect, docker run, container management, docker commands, container operations]
keywords: [docker, container, lifecycle, run, ps, start, stop, restart, pause, unpause, kill, wait, logs, exec, attach, stats, inspect, diff, top, port, rm, prune, exit code, OOM, crash loop, debugging, container management, detached, interactive, volume mount, port mapping, environment variables, restart policy, resource limits, network, env-file, SIGTERM, SIGKILL, graceful shutdown, docker cp, go template, filter, format]
description: "Comprehensive Docker container lifecycle reference — running containers with all key flags, listing and filtering, lifecycle management (start/stop/kill/pause), logs, exec, file copying, inspection, debugging, and cleanup. Covers everything a data engineer needs to manage containers day-to-day."
related:
  - "[[docker-compose]]"
  - "[[image-management]]"
  - "[[docker-cheat-sheet]]"
  - "[[managing-services]]"
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Container Lifecycle

Docker containers are the runtime environment for pipeline stages, databases, and monitoring agents. Each step — loader, transform, scorer — runs in a container with its own dependencies, isolated from the host system. This note covers every container operation you need as a data engineer, from launching a one-off job to debugging a crash loop in production.

---

## Running Containers (`docker run`)

`docker run` creates and starts a new container from an image. Every flag below serves a specific operational purpose.

### Core Flags

**Detached mode — run in the background:**
```bash
# -d starts the container in the background and prints the container ID
docker run -d --name airflow-scheduler airflow:2.8
```

**Interactive mode — open a shell inside a container:**
```bash
# -it = -i (keep stdin open) + -t (allocate a pseudo-TTY)
# Use this to explore an image interactively or debug a running process
docker run -it --name debug-session python:3.11 bash
```

**Name the container:**
```bash
# Without --name, Docker assigns a random name like "hungry_tesla"
# Named containers are easier to reference in logs, exec, stop, etc.
docker run -d --name postgres-db postgres:16
```

**Port mapping — publish container ports to the host:**
```bash
# -p HOST_PORT:CONTAINER_PORT
# Maps container port 5432 to host port 5432
docker run -d --name postgres-db -p 5432:5432 postgres:16

# Map to a different host port (useful when 5432 is already in use)
docker run -d --name postgres-db2 -p 5433:5432 postgres:16

# Bind to a specific host interface (security: only localhost can connect)
docker run -d --name postgres-db -p 127.0.0.1:5432:5432 postgres:16
```

**Volume mounts — persist data and inject config files:**
```bash
# -v HOST_PATH:CONTAINER_PATH
# Mount a host directory into the container
docker run -d --name postgres-db \
  -v /data/postgres:/var/lib/postgresql/data \
  postgres:16

# Mount a config file (read-only with :ro suffix)
docker run -d --name airflow-scheduler \
  -v /opt/airflow/dags:/opt/airflow/dags:ro \
  airflow:2.8

# Mount current working directory (common in local development)
docker run -it --rm \
  -v "$(pwd)":/workspace \
  -w /workspace \
  python:3.11 bash
# -w sets the working directory inside the container
```

**Environment variables — pass configuration at runtime:**
```bash
# -e KEY=VALUE sets a single environment variable
docker run -d --name postgres-db \
  -e POSTGRES_USER=airflow \
  -e POSTGRES_PASSWORD=airflow \
  -e POSTGRES_DB=airflow \
  postgres:16
```

**Environment file — load variables from a file:**
```bash
# --env-file loads all KEY=VALUE pairs from a file
# The file must NOT have "export" prefixes — plain KEY=VALUE only
docker run -d --name my-pipeline \
  --env-file .env \
  my-pipeline-image:latest

# Useful .env file format:
# DB_HOST=postgres-db
# DB_PORT=5432
# GCP_PROJECT=my-project
```

> [!tip] .env File Security
> Never commit `.env` files to git. Add `.env` to `.gitignore`. For CI/CD, inject secrets via the pipeline platform's secret store (GitHub Actions secrets, GitLab CI variables, etc.) and pass them with `--env-file` or `-e` at runtime.

**Auto-remove on exit — clean up one-off containers automatically:**
```bash
# --rm deletes the container immediately when it exits
# Perfect for one-off jobs, data transforms, or debugging sessions
docker run --rm python:3.11 python -c "import sys; print(sys.version)"

# Run a one-off dbt command without leaving a stopped container behind
docker run --rm \
  -v "$(pwd)":/dbt \
  -w /dbt \
  --env-file .env \
  ghcr.io/dbt-labs/dbt-bigquery:1.7 \
  dbt run --select my_model
```

**Restart policy — automatically restart containers after failure or reboot:**
```bash
# --restart controls when Docker automatically restarts the container
# Options: no (default), always, unless-stopped, on-failure[:max-retries]

# Always restart (even after docker daemon restart) — for long-running services
docker run -d --name airflow-scheduler \
  --restart always \
  airflow:2.8

# Restart only on non-zero exit code (not on manual docker stop)
docker run -d --name my-worker \
  --restart on-failure:5 \   # retry up to 5 times before giving up
  my-worker-image:latest

# Unless-stopped: restart always EXCEPT when you explicitly stop it
# Best default for production services — survives host reboots
docker run -d --name postgres-db \
  --restart unless-stopped \
  postgres:16
```

| Policy | Restarts on crash? | Restarts on reboot? | Restarts after `docker stop`? |
|---|---|---|---|
| `no` | No | No | No |
| `on-failure` | Yes | No | No |
| `always` | Yes | Yes | Yes |
| `unless-stopped` | Yes | Yes | No |

**Resource limits — cap CPU and memory:**
```bash
# --memory caps RAM usage (prevents OOM-killing other containers)
# --cpus caps CPU usage as a fraction of available cores
docker run -d --name my-transform \
  --memory 2g \          # hard limit: 2 GB RAM
  --memory-swap 2g \     # set equal to --memory to disable swap
  --cpus 1.5 \           # can use at most 1.5 CPU cores
  my-transform-image:latest

# Check what limits are set on a running container
docker inspect my-transform --format='Memory: {{.HostConfig.Memory}}, CPUs: {{.HostConfig.NanoCpus}}'
```

> [!warning] OOM Kills
> If a container exceeds its `--memory` limit, the Linux kernel kills it with SIGKILL. The exit code will be 137. Always set memory limits on containers running untrusted or unpredictable workloads. See the [[#Exit Code Reference]] table below.

**Network — attach to a specific Docker network:**
```bash
# --network connects the container to a named network
# Containers on the same network can reach each other by container name
docker run -d --name my-app \
  --network my-pipeline-network \
  my-app-image:latest

# Create the network first if it doesn't exist
docker network create my-pipeline-network
```

### Complete `docker run` Example

**Full production-style run command for a data pipeline worker:**
```bash
docker run -d \
  --name pipeline-worker \
  --restart unless-stopped \
  --memory 4g \
  --cpus 2 \
  -p 8080:8080 \
  -v /data/pipeline:/data \
  -v /opt/pipeline/config:/app/config:ro \
  --env-file /opt/pipeline/.env \
  -e LOG_LEVEL=INFO \
  --network pipeline-network \
  my-pipeline-worker:2.1.0
```

### Common One-Off Patterns

**Run a Python script against live data, then delete the container:**
```bash
docker run --rm \
  -v "$(pwd)/scripts":/scripts \
  --env-file .env \
  python:3.11 \
  python /scripts/backfill.py --date 2026-01-01
```

**Open an interactive shell in a container image to explore it:**
```bash
# Useful for checking what's installed, what paths exist, etc.
docker run --rm -it ubuntu:24.04 bash
docker run --rm -it python:3.11 python  # opens Python REPL
```

**Run a database client to connect to a containerized DB:**
```bash
# Connect psql to a running postgres container
docker run --rm -it \
  --network pipeline-network \
  postgres:16 \
  psql -h postgres-db -U airflow -d airflow
```

---

## Listing and Filtering Containers

### Basic Listing

**List running containers:**
```bash
# List running containers
sudo docker ps
# CONTAINER ID  IMAGE              STATUS         PORTS      NAMES
# 39c312ed574a  airflow:2.8        Up 3 days                 airflow-triggerer
# f3dc649e45a5  airflow:2.8        Up 3 days                 airflow-scheduler
# KEY FIELDS:
# STATUS = Up X days (healthy) or Exited (crashed) or Restarting (crash loop)
# NAMES = the container name (what you use in docker exec, logs, etc.)

# All containers including stopped
sudo docker ps -a
# Stopped containers consume disk space — clean them periodically
```

**List only container IDs (useful in scripts):**
```bash
# -q outputs only container IDs — pipe to other commands
docker ps -q                   # IDs of running containers
docker ps -aq                  # IDs of ALL containers (including stopped)

# Stop all running containers at once
docker stop $(docker ps -q)

# Remove all stopped containers
docker rm $(docker ps -aq -f status=exited)
```

### Filtering

**Filter containers by status, name, or label:**
```bash
# Filter by status
docker ps -a --filter status=exited      # show only stopped containers
docker ps -a --filter status=running     # same as docker ps
docker ps -a --filter status=restarting  # actively crash-looping containers

# Filter by name (substring match)
docker ps --filter name=airflow          # all containers with "airflow" in name

# Filter by image
docker ps -a --filter ancestor=postgres:16   # containers using this image

# Filter by exit code (useful to find crashed containers)
docker ps -a --filter exited=137         # containers killed by OOM or SIGKILL
docker ps -a --filter exited=1           # containers that exited with an app error
```

### Custom Formatting with Go Templates

**Format `docker ps` output for scripts or readability:**
```bash
# Show only name, status, and image — tab-separated
docker ps --format "{{.Names}}\t{{.Status}}\t{{.Image}}"

# Add a header row
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}"

# Show when the container was created
docker ps -a --format "table {{.Names}}\t{{.CreatedAt}}\t{{.Status}}"

# Available fields: .ID, .Image, .Command, .CreatedAt, .RunningFor,
#                  .Ports, .Status, .Size, .Names, .Labels, .Mounts, .Networks
```

---

## Lifecycle Management

### Start, Stop, Restart

```bash
# Start / stop / restart
sudo docker start airflow-scheduler
sudo docker stop airflow-scheduler    # sends SIGTERM, waits 10s, then SIGKILL
sudo docker restart airflow-scheduler

# Start multiple containers at once
docker start postgres-db redis-cache airflow-scheduler

# Restart all running containers matching a name pattern
docker ps --filter name=airflow -q | xargs docker restart
```

### Graceful Shutdown: `stop` vs `kill`

```bash
# docker stop: sends SIGTERM, waits for the process to exit cleanly, then SIGKILL
# This is the correct way to stop a container — gives the app time to flush buffers,
# close DB connections, finish in-flight requests
docker stop airflow-scheduler         # default 10-second timeout

# Extend the timeout for slow-to-stop containers (e.g., Spark jobs)
docker stop -t 60 spark-worker        # wait up to 60 seconds before SIGKILL

# docker kill: sends SIGKILL immediately — no cleanup, no grace period
# Use only when docker stop hangs or for containers you don't care about
docker kill airflow-scheduler

# Send a specific signal (useful for containers that handle SIGUSR1, etc.)
docker kill --signal SIGHUP nginx-container   # trigger config reload without restart
```

> [!warning] Data Loss Risk with `docker kill`
> `docker kill` bypasses graceful shutdown. Databases may corrupt write-ahead logs, pipelines may leave partial outputs, and in-flight transactions may be lost. Always prefer `docker stop` with an appropriate `-t` timeout.

### Pause and Unpause

```bash
# docker pause: freezes all processes in a container (sends SIGSTOP to cgroups)
# The container appears "Up (Paused)" in docker ps
# Use when you need to temporarily freeze a container without stopping it
docker pause airflow-scheduler

# docker unpause: resumes all processes
docker unpause airflow-scheduler
```

> [!info] When to Use Pause
> Pausing is useful for taking consistent filesystem snapshots (volume backup while the app isn't writing), or temporarily relieving CPU pressure without losing the container's state. It is not a substitute for a proper maintenance window.

### Wait for a Container to Exit

```bash
# docker wait: blocks until a container stops, then prints its exit code
# Useful in scripts where you need to know when a job container finishes
docker wait my-batch-job
# Output: 0   (or whatever the exit code was)

# Pattern: run a job and capture its exit code in a script
docker run -d --name my-job my-job-image:latest
EXIT_CODE=$(docker wait my-job)
if [ "$EXIT_CODE" -ne 0 ]; then
  echo "Job failed with exit code $EXIT_CODE"
  docker logs my-job --tail 50
fi
docker rm my-job
```

---

## Viewing Logs

### Basic Log Commands

```bash
# View logs
sudo docker logs airflow-scheduler --tail 100
# --tail 100 = last 100 lines (without this, ALL logs since container start)

# Follow in real-time (like tail -f)
sudo docker logs -f airflow-scheduler

# Combine: follow from last 30 minutes of logs
sudo docker logs -f airflow-scheduler --since 30m

# Show timestamps on every log line
docker logs --timestamps airflow-scheduler --tail 50

# Show logs between two times
docker logs --since "2026-03-22T08:00:00" --until "2026-03-22T09:00:00" airflow-scheduler
```

### Log Filtering Patterns

```bash
# Pipe logs into grep for quick filtering (combine with -f for real-time)
docker logs airflow-scheduler --tail 200 | grep -i error
docker logs airflow-scheduler --tail 200 | grep -i "dag_id=my_dag"

# Follow and filter simultaneously
docker logs -f airflow-scheduler 2>&1 | grep --line-buffered "ERROR|CRITICAL"
# 2>&1 redirects stderr to stdout (many apps log errors to stderr)
```

### Following Logs from Multiple Containers

```bash
# There is no built-in multi-container log follow in vanilla Docker.
# Use docker-compose logs for compose stacks (see [[docker-compose]])
docker compose logs -f airflow-scheduler airflow-worker

# For non-compose setups, run multiple follows in parallel with:
docker logs -f container-a &
docker logs -f container-b &
wait   # blocks until both are killed (Ctrl+C)

# Or use a tool like loki, stern (Kubernetes-style), or logspout for multi-container log aggregation
```

> [!tip] Log Driver
> By default, Docker stores logs in JSON files on the host (`/var/lib/docker/containers/<id>/<id>-json.log`). For production, configure a log driver (`--log-driver`) such as `journald`, `fluentd`, or `awslogs` to ship logs to a centralized system.

---

## Exec and Attach

### Interactive Shell Inside a Container

```bash
# Execute a command inside a running container
sudo docker exec -it airflow-scheduler bash
# -it = interactive terminal (opens a shell inside the container)
# This is how you debug: inspect files, check configs, test connectivity from inside

# If bash isn't available (minimal images), try sh
docker exec -it alpine-container sh

# Open a Python REPL inside a Python container
docker exec -it my-python-app python
```

### Non-Interactive Command Execution

```bash
# Non-interactive command execution
sudo docker exec airflow-scheduler airflow dags list
# Runs the command and returns output — no interactive shell

# Run a health check query against a containerized database
docker exec postgres-db psql -U airflow -d airflow -c "SELECT count(*) FROM dag;"

# Trigger an Airflow DAG from outside the container
docker exec airflow-scheduler airflow dags trigger my_pipeline_dag
```

### Running as a Different User

```bash
# -u specifies the user to run the command as inside the container
# Useful when you need root for debugging but the container normally runs as non-root
docker exec -u root -it airflow-scheduler bash

# Run as a specific UID (useful when the image uses numeric IDs)
docker exec -u 1001 my-app bash

# Check what user the main process is running as
docker exec my-app whoami
```

### Setting Environment Variables in exec

```bash
# Pass environment variables to an exec'd command
docker exec -e DEBUG=true -it my-app python debug_script.py
```

### Copying Files To and From Containers

```bash
# docker cp copies files between host and container (works on stopped containers too)

# Copy FROM container TO host
docker cp airflow-scheduler:/opt/airflow/logs/dag_processor.log ./dag_processor.log

# Copy TO container FROM host
docker cp ./my_dag.py airflow-scheduler:/opt/airflow/dags/my_dag.py

# Copy a directory (copies the directory itself, not just its contents)
docker cp airflow-scheduler:/opt/airflow/logs ./container-logs/

# Useful patterns:
# - Extract a generated report from a finished container
# - Inject a patched config without rebuilding the image
# - Recover logs from a crashed container before removing it
```

> [!tip] `docker cp` on Stopped Containers
> Unlike `docker exec`, `docker cp` works even on containers that have exited. This makes it the primary tool for extracting artifacts or logs from a container that has already crashed.

---

## Inspection and Debugging

### `docker inspect` — Full Container Metadata

```bash
# Inspect container metadata (mounts, environment, network)
sudo docker inspect airflow-scheduler --format='{{json .Mounts}}' | python3 -m json.tool
# Extracts the mount configuration as pretty-printed JSON
# Critical for: "Where does this container store its data?" "What's mounted where?"

# Check which image the container was started from (full image ID)
docker inspect my-app --format='{{.Image}}'

# Get the container's IP address on a specific network
docker inspect my-app --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'

# Get all environment variables the container was started with
docker inspect my-app --format='{{range .Config.Env}}{{println .}}{{end}}'

# Get the restart policy
docker inspect my-app --format='{{.HostConfig.RestartPolicy.Name}}'

# Get the container start time
docker inspect my-app --format='{{.State.StartedAt}}'

# Dump the full inspect output as pretty JSON (useful as a starting point)
docker inspect my-app | python3 -m json.tool
```

### `docker top` — Processes Inside a Container

```bash
# Show the processes running inside a container (like ps aux, but from outside)
docker top airflow-scheduler

# Pass ps flags for more detail
docker top airflow-scheduler aux       # show all processes with CPU/memory %
docker top airflow-scheduler -o pid,ppid,cmd   # custom columns
```

### `docker diff` — Filesystem Changes

```bash
# Show all files added (A), changed (C), or deleted (D) since the container started
# Useful to understand what a container has written to its writable layer
docker diff airflow-scheduler
# Output:
# C /var/log
# A /var/log/airflow/dag.log
# C /etc/hosts

# Patterns to look for:
# Large numbers of A entries in /tmp or /var = container generating temp files
# C entries in paths that should be read-only = unexpected config modification
```

### `docker stats` — Resource Usage

```bash
# Resource usage (CPU, memory, network, disk I/O per container)
sudo docker stats --no-stream
# --no-stream = show one snapshot and exit
# Look for: MEM USAGE approaching MEM LIMIT → container will be OOM-killed
# Look for: high CPU % → the container is compute-bound

# Follow stats in real-time (refresh every second)
docker stats

# Stats for specific containers only
docker stats airflow-scheduler airflow-worker postgres-db

# Format stats output for scripting
docker stats --no-stream --format "{{.Name}}: CPU={{.CPUPerc}} MEM={{.MemUsage}}"
```

### `docker port` — Port Mapping Check

```bash
# Show which host ports a container's ports are mapped to
docker port airflow-webserver
# Output:
# 8080/tcp -> 0.0.0.0:8080

# Check a specific container port
docker port airflow-webserver 8080
# Output: 0.0.0.0:8080
```

---

## Removing Containers

```bash
# Remove a stopped container
docker rm my-old-container

# Force-remove a running container (equivalent to kill + rm)
docker rm -f my-container       # sends SIGKILL then removes

# Remove multiple containers at once
docker rm container-a container-b container-c

# Remove all stopped containers
docker container prune           # prompts for confirmation
docker container prune -f        # no confirmation prompt

# Remove all exited containers in one line (alternative to prune)
docker rm $(docker ps -aq --filter status=exited)

# Remove a container and its anonymous volumes
docker rm -v my-container        # -v removes volumes created by the container
```

> [!warning] Stopped Containers Consume Disk
> Docker does not remove containers automatically (unless `--rm` was used at run time). A system running containers for months will accumulate hundreds of stopped containers. Run `docker system df` to see how much space they consume, and `docker container prune` to clean up.

---

## Container Debugging Checklist

> [!warning] When a Container Keeps Crashing (Restart Loop)

**Step 1 — Identify crash-looping containers:**
```bash
# Containers in "Restarting" status are crash-looping
docker ps -a --filter status=restarting

# See how many times a container has restarted
docker inspect <container> --format='Restarts: {{.RestartCount}}'
```

**Step 2 — Check the exit code:**
```bash
sudo docker inspect <container> --format='{{.State.ExitCode}}'
# 0 = clean exit, 1 = application error, 137 = SIGKILL (OOM), 139 = SIGSEGV (crash)
```

**Step 3 — Check logs for the error message:**
```bash
sudo docker logs <container> --tail 50

# If the container restarts too fast to catch logs, add --timestamps to correlate with the crash time
docker logs --timestamps <container> --tail 100
```

**Step 4 — If OOM killed (exit 137), check memory limits:**
```bash
sudo docker inspect <container> --format='{{.HostConfig.Memory}}'
# 0 = no limit (uses all host memory)
# Nonzero = limit in bytes — may be too low

# Check current memory usage with stats (if container is briefly up)
docker stats --no-stream <container>
```

**Step 5 — Check if the filesystem is full:**
```bash
sudo docker system df
# Shows: images, containers, volumes, build cache and their sizes

# Check the host disk
df -h /var/lib/docker
```

**Step 6 — Try running the container interactively to reproduce the error:**
```bash
# Override the entrypoint to get a shell instead of the app starting
docker run --rm -it \
  --entrypoint bash \
  --env-file .env \
  my-broken-image:latest
# Now you can manually run the startup command and see the full error
```

**Step 7 — Inspect environment and mounts:**
```bash
# Verify the env vars the container sees
docker inspect <container> --format='{{range .Config.Env}}{{println .}}{{end}}'

# Verify volume mounts are correct
docker inspect <container> --format='{{json .Mounts}}' | python3 -m json.tool
```

---

## Exit Code Reference

| Code | Signal | Meaning | Common Cause |
|------|--------|---------|--------------|
| 0 | — | Clean exit | Normal completion |
| 1 | — | Application error | Unhandled exception, missing config, bad args |
| 2 | — | Shell/misuse error | Invalid shell syntax, missing command |
| 125 | — | Docker daemon error | Invalid `docker run` flags |
| 126 | — | Command not executable | Permission denied on entrypoint |
| 127 | — | Command not found | Entrypoint binary doesn't exist in image |
| 130 | SIGINT | Interrupted by Ctrl+C | Manual interruption in interactive mode |
| 137 | SIGKILL | Killed (often OOM) | Memory limit exceeded, or `docker kill` |
| 139 | SIGSEGV | Segmentation fault | Crash in C extension, memory corruption |
| 143 | SIGTERM | Graceful termination | `docker stop` completed within timeout |

> [!tip] Decoding Exit Codes
> Exit codes 128+N mean the process was killed by Unix signal N. So 128+9 (SIGKILL) = 137, and 128+15 (SIGTERM) = 143. When you see 137, your first question should be: OOM kill or explicit `docker kill`? Check `docker inspect <container> --format='{{.State.OOMKilled}}'` — if `true`, it was OOM.

```bash
# Definitive OOM check — returns true or false
docker inspect <container> --format='{{.State.OOMKilled}}'
```

---

## Related

- [[docker-compose]] — Orchestrating multi-container stacks
- [[image-management]] — Building, tagging, and pushing images
- [[docker-cheat-sheet]] — Quick reference for all Docker commands
- [[managing-services]] — Managing long-running service containers
